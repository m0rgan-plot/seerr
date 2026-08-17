import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import type { MediaList } from '@server/features/mediaLists/domain/entities/MediaList';
import type { MediaListItem } from '@server/features/mediaLists/domain/entities/MediaListItem';
import type { NotificationGateway } from '@server/features/mediaLists/domain/ports/NotificationGateway';
import { CollaboratorRole } from '@server/features/mediaLists/domain/valueObjects/CollaboratorRole';
import type { UserRef } from '@server/features/mediaLists/domain/valueObjects/UserRef';
import notificationManager, { Notification } from '@server/lib/notifications';
import type { NotificationPayload } from '@server/lib/notifications/agents/agent';
import logger from '@server/logger';

// These are person to person notifications rather than admin alerts, so every payload
// targets a single recipient through notifyUser and leaves the admin fan-out off.
export class NotificationGatewayImpl implements NotificationGateway {
  public async notifyListShared(input: {
    list: MediaList;
    recipient: UserRef;
    role: CollaboratorRole;
    invitedBy: UserRef;
  }): Promise<void> {
    const recipient = await this.resolveUser(input.recipient.id);
    if (!recipient) {
      return;
    }

    const canEdit = input.role === CollaboratorRole.WRITE;

    this.send(Notification.MEDIA_LIST_SHARED, {
      event: 'Watchlist Invite',
      subject: input.list.name,
      message: `${input.invitedBy.displayName} invited you to a watchlist. Accept the invite to ${
        canEdit ? 'add and remove titles' : 'view it'
      }.`,
      notifyUser: recipient,
      extra: [
        { name: 'Watchlist', value: input.list.name },
        { name: 'Invited by', value: input.invitedBy.displayName },
        { name: 'Access offered', value: canEdit ? 'Can edit' : 'Can view' },
      ],
    });
  }

  public async notifyItemAdded(input: {
    list: MediaList;
    item: MediaListItem;
    addedBy: UserRef;
    recipients: UserRef[];
  }): Promise<void> {
    const recipients = await Promise.all(
      input.recipients.map((recipient) => this.resolveUser(recipient.id))
    );

    // One notification per recipient, since notifyUser addresses a single person and each
    // member has their own delivery settings.
    recipients
      .filter((recipient): recipient is User => !!recipient)
      .forEach((recipient) => {
        this.send(Notification.MEDIA_LIST_ITEM_ADDED, {
          event: 'Watchlist Updated',
          subject: input.list.name,
          message: `${input.addedBy.displayName} added a title to ${input.list.name}.`,
          notifyUser: recipient,
          extra: [
            { name: 'Watchlist', value: input.list.name },
            { name: 'Added by', value: input.addedBy.displayName },
          ],
        });
      });
  }

  private send(
    type: Notification,
    payload: Omit<NotificationPayload, 'notifySystem' | 'notifyAdmin'>
  ): void {
    try {
      notificationManager.sendNotification(type, {
        ...payload,
        notifySystem: true,
        notifyAdmin: false,
      });
    } catch (e) {
      // Agents are handed the payload synchronously, so one throwing agent would
      // otherwise surface as a failed add or share that has in fact already been
      // written, and the client would retry into a conflict.
      logger.error('Unable to send watchlist notification', {
        label: 'Media Lists',
        notificationType: Notification[type],
        errorMessage: e.message,
      });
    }
  }

  private async resolveUser(userId: number): Promise<User | null> {
    try {
      return await getRepository(User).findOne({ where: { id: userId } });
    } catch (e) {
      // A missing recipient should never take down the action that triggered it.
      logger.warn('Unable to resolve watchlist notification recipient', {
        label: 'Media Lists',
        userId,
        errorMessage: e.message,
      });
      return null;
    }
  }
}
