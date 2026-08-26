import Modal from '@app/components/Common/Modal';
import { useMediaListMutations } from '@app/domain/mediaLists/hooks/useMediaListMutations';
import type { MediaList } from '@app/domain/mediaLists/models/MediaList';
import { canDeleteList } from '@app/domain/mediaLists/models/MediaList';
import useToasts from '@app/hooks/useToasts';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import { Field, Form, Formik } from 'formik';
import { useIntl } from 'react-intl';
import * as Yup from 'yup';

const messages = defineMessages(
  'components.Watchlists.CreateEditWatchlistModal',
  {
    createtitle: 'New Watchlist',
    edittitle: 'Edit Watchlist',
    name: 'Name',
    nameplaceholder: 'Sunday Night Sci-Fi',
    namerequired: 'You must provide a name',
    description: 'Description',
    descriptionhint: 'Shown on the list and to anyone you share it with.',
    create: 'Create Watchlist',
    createsuccess: 'Watchlist created.',
    createfailed: 'Something went wrong creating the watchlist.',
    editsuccess: 'Watchlist updated.',
    editfailed: 'Something went wrong updating the watchlist.',
    deletelist: 'Delete List',
  }
);

interface CreateEditWatchlistModalProps {
  show: boolean;
  // Absent when creating, present when editing.
  list?: MediaList;
  onComplete: () => void;
  onCancel: () => void;
  onRequestDelete?: () => void;
}

const CreateEditWatchlistModal = ({
  show,
  list,
  onComplete,
  onCancel,
  onRequestDelete,
}: CreateEditWatchlistModalProps) => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const { createList, updateList } = useMediaListMutations();

  const isEdit = !!list;

  const schema = Yup.object().shape({
    name: Yup.string()
      .trim()
      .required(intl.formatMessage(messages.namerequired)),
    description: Yup.string().max(500),
  });

  return (
    <Transition
      as="div"
      enter="transition duration-300"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="transition duration-300"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
      show={show}
    >
      <Formik
        initialValues={{
          name: list?.name ?? '',
          description: list?.description ?? '',
        }}
        validationSchema={schema}
        enableReinitialize
        onSubmit={async (values) => {
          try {
            if (isEdit) {
              await updateList(
                { name: values.name, description: values.description },
                list.id
              );
              addToast(intl.formatMessage(messages.editsuccess), {
                appearance: 'success',
                autoDismiss: true,
              });
            } else {
              await createList({
                name: values.name,
                description: values.description,
              });
              addToast(intl.formatMessage(messages.createsuccess), {
                appearance: 'success',
                autoDismiss: true,
              });
            }
            onComplete();
          } catch {
            addToast(
              intl.formatMessage(
                isEdit ? messages.editfailed : messages.createfailed
              ),
              { appearance: 'error', autoDismiss: true }
            );
          }
        }}
      >
        {({ errors, touched, isSubmitting, isValid, handleSubmit }) => (
          <Modal
            title={intl.formatMessage(
              isEdit ? messages.edittitle : messages.createtitle
            )}
            onCancel={onCancel}
            onOk={() => handleSubmit()}
            okDisabled={isSubmitting || !isValid}
            okText={intl.formatMessage(
              isEdit ? globalMessages.save : messages.create
            )}
            okButtonType="primary"
            loading={isSubmitting}
            // The owner alone can delete, so the action only appears for them.
            onSecondary={
              isEdit && onRequestDelete && canDeleteList(list.role)
                ? onRequestDelete
                : undefined
            }
            secondaryText={
              isEdit && onRequestDelete && canDeleteList(list.role)
                ? intl.formatMessage(messages.deletelist)
                : undefined
            }
            secondaryButtonType="danger"
            secondaryDisabled={isSubmitting}
          >
            <Form className="section">
              <div className="form-row">
                <label htmlFor="name" className="text-label">
                  {intl.formatMessage(messages.name)}
                  <span className="label-required">*</span>
                </label>
                <div className="form-input-area">
                  <Field
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="off"
                    placeholder={intl.formatMessage(messages.nameplaceholder)}
                  />
                  {errors.name && touched.name && (
                    <div className="error">{errors.name}</div>
                  )}
                </div>
              </div>

              <div className="form-row">
                <label htmlFor="description" className="text-label">
                  {intl.formatMessage(messages.description)}
                  <span className="label-tip">
                    {intl.formatMessage(messages.descriptionhint)}
                  </span>
                </label>
                <div className="form-input-area">
                  <Field
                    id="description"
                    name="description"
                    as="textarea"
                    rows="3"
                  />
                  {errors.description && touched.description && (
                    <div className="error">{errors.description}</div>
                  )}
                </div>
              </div>
            </Form>
          </Modal>
        )}
      </Formik>
    </Transition>
  );
};

export default CreateEditWatchlistModal;
