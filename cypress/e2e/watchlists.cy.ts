// Titles used through the spec. Dune is a movie, Silo a series with several seasons,
// which is what the episode assertions need.
const MOVIE = { tmdbId: 693134, title: 'Dune: Part Two' };
const SERIES = { tmdbId: 125988, title: 'Silo' };

const createList = (name: string, description = '') =>
  cy
    .request('POST', '/api/v1/mediaLists', { name, description })
    .its('body.id');

const addItem = (listId: number, tmdbId: number, mediaType: 'movie' | 'tv') =>
  cy.request('POST', `/api/v1/mediaLists/${listId}/items`, {
    tmdbId,
    mediaType,
  });

// Cards follow the app's poster pattern: the title and the actions live in the hover
// overlay, so a card is reached by its tmdb id and opened before anything is clicked.
const card = (tmdbId: number) =>
  cy.get(`[data-testid=watchlist-item][data-tmdb-id="${tmdbId}"]`);

// The friend's id is whatever the seed produced, so it is looked up rather than assumed.
const shareWithFriend = (listId: number, role: 'read' | 'write') =>
  cy
    .request('/api/v1/user?q=friend')
    .its('body.results')
    .then((users: { id: number; email: string }[]) => {
      const friend = users.find((user) => user.email.startsWith('friend'));
      if (!friend) {
        throw new Error('the seeded friend user was not found');
      }
      cy.request('POST', `/api/v1/mediaLists/${listId}/collaborators`, {
        userId: friend.id,
        role,
      });
    });

// Sharing only creates a pending invite now, so tests about what a role can do accept it
// over the API first rather than exercising the invite UI on every one of them.
const acceptInviteViaApi = (listId: number) =>
  cy.request('POST', `/api/v1/mediaLists/${listId}/invite/accept`);

const openCard = (tmdbId: number) => {
  // React synthesises enter and leave from mouseover and mouseout, so a mouseenter
  // dispatched on its own never reaches the handler.
  card(tmdbId).find('[data-testid=watchlist-item-poster]').trigger('mouseover');
  return card(tmdbId);
};

describe('Watchlists', () => {
  beforeEach(() => {
    cy.loginAsAdmin();
    // Each spec starts from whatever the previous one left, so the lists this file
    // creates are removed rather than assumed absent.
    cy.request('/api/v1/mediaLists').then((response) => {
      response.body.forEach((list: { id: number; role: string }) => {
        if (list.role === 'owner') {
          cy.request('DELETE', `/api/v1/mediaLists/${list.id}`);
        }
      });
    });
  });

  it('reaches the watchlists page from the desktop sidebar', () => {
    // The sidebar is hidden below the lg breakpoint, and Cypress defaults narrower
    // than that, so the desktop entry needs a wide viewport to be reachable at all.
    cy.viewport(1280, 800);
    cy.visit('/');

    cy.get('[data-testid=sidebar-menu-watchlists]').click();

    cy.get('[data-testid=page-header]').should('contain', 'Watchlists');
  });

  it('reaches the watchlists page from the mobile menu', () => {
    cy.visit('/');

    cy.get('[data-testid=sidebar-toggle]').click();
    cy.get('[data-testid=sidebar-menu-watchlists-mobile]').click();

    cy.get('[data-testid=page-header]').should('contain', 'Watchlists');
  });

  it('shows the empty state and creates the first list', () => {
    cy.visit('/watchlists');

    cy.contains('No Watchlists Yet');
    cy.contains('Create a Watchlist').click();

    cy.get('[data-testid=modal-title]').should('contain', 'New Watchlist');
    cy.get('#name').type('Sunday Night Sci-Fi');
    cy.get('#description').type('Slow burn science fiction.');
    cy.contains('button', 'Create Watchlist').click();

    cy.get('[data-testid=watchlist-shelf]')
      .should('have.length', 1)
      .and('contain', 'Sunday Night Sci-Fi')
      .and('contain', 'Owner');
  });

  it('renames a list and deletes it', () => {
    createList('Temporary list').then(() => {
      cy.visit('/watchlists');

      cy.get('[data-testid=watchlist-shelf]')
        .contains('Temporary list')
        .parents('[data-testid=watchlist-shelf]')
        .find('button[title^="Options"]')
        .click();

      cy.get('#name').clear().type('Renamed list');
      cy.get('[data-testid=modal-ok-button]').click();
      cy.get('[data-testid=watchlist-shelf]').should('contain', 'Renamed list');

      cy.get('[data-testid=watchlist-shelf] button[title^="Options"]').click();
      cy.get('[data-testid=modal-secondary-button]').click();
      // The edit modal is mounted through its leave transition, so waiting for a single
      // dialog is what keeps the confirm click off the one on its way out.
      cy.get('[data-testid=modal-title]')
        .should('have.length', 1)
        .and('contain', 'Delete Watchlist');
      cy.get('[data-testid=modal-ok-button]').click();

      cy.contains('No Watchlists Yet');
    });
  });

  it('adds a title and shares without leaving the index', function () {
    createList('Film club').then((listId: number) => {
      cy.visit('/watchlists');

      // The add tile opens the dialog in place rather than routing to the list.
      cy.get('[data-testid=watchlist-shelf]')
        .find('button[aria-label^="Add titles"]')
        .click();
      cy.get('[data-testid=modal-title]').should('contain', 'Add Media');
      cy.get('#watchlist-add-search').type(MOVIE.title);
      // Scoped to the result row: the strip behind the modal has an "Add" tile of its
      // own, and it comes first in the document.
      cy.get('[data-testid=watchlist-add-result]').first().click();
      cy.get('[data-testid=watchlist-add-result]')
        .first()
        .should('contain', 'Added');
      cy.get('[data-testid=modal-ok-button]').click();
      // Let the dialog finish leaving, so the next one is the only one on screen.
      cy.get('[data-testid=modal-title]').should('not.exist');

      cy.get('[data-testid=watchlist-shelf] button[title^="Share"]').click();
      // Modal tags its subtitle with the same testid, so this dialog carries two.
      cy.get('[data-testid=modal-title]')
        .should('contain', 'Share Watchlist')
        .and('contain', 'Film club');
      cy.contains('People with Access').should('exist');

      cy.request(`/api/v1/mediaLists/${listId}/items`)
        .its('body')
        .should('have.length', 1);
    });
  });

  it('shows a title already on the list as Added before it is clicked', () => {
    createList('Already have this').then((listId: number) => {
      addItem(listId, MOVIE.tmdbId, 'movie');
      cy.visit('/watchlists');

      cy.get('[data-testid=watchlist-shelf]')
        .find('button[aria-label^="Add titles"]')
        .click();
      cy.get('#watchlist-add-search').type(MOVIE.title);

      cy.get('[data-testid=watchlist-add-result]')
        .first()
        .should('contain', 'Added')
        .and('be.disabled');
    });
  });

  it('adds a title to a list from the media page', () => {
    createList('From the media page').then((listId: number) => {
      cy.visit(`/movie/${MOVIE.tmdbId}`);

      cy.get('[data-testid=add-to-watchlist-button]').click();
      cy.get('[data-testid=add-to-watchlist-item]')
        .contains('From the media page')
        .click();
      cy.get('[data-testid=add-to-watchlist-item]')
        .contains('From the media page')
        .should('have.attr', 'data-added', 'true');

      cy.request(`/api/v1/mediaLists/${listId}/items`)
        .its('body')
        .should('have.length', 1);

      // A fresh page load still knows the title is already there, not just this
      // session's own click.
      cy.reload();
      cy.get('[data-testid=add-to-watchlist-button]').click();
      cy.get('[data-testid=add-to-watchlist-item]')
        .contains('From the media page')
        .should('have.attr', 'data-added', 'true');
    });
  });

  it('shows a title already on the list as Added on the media page before it is clicked', () => {
    createList('Already has this movie').then((listId: number) => {
      addItem(listId, MOVIE.tmdbId, 'movie');
      cy.visit(`/movie/${MOVIE.tmdbId}`);

      cy.get('[data-testid=add-to-watchlist-button]').click();
      cy.get('[data-testid=add-to-watchlist-item]')
        .contains('Already has this movie')
        .should('have.attr', 'data-added', 'true');
    });
  });

  it('removes a title from a list by clicking it again on the media page', () => {
    createList('Toggle from the media page').then((listId: number) => {
      addItem(listId, MOVIE.tmdbId, 'movie');
      cy.visit(`/movie/${MOVIE.tmdbId}`);

      cy.get('[data-testid=add-to-watchlist-button]').click();
      cy.get('[data-testid=add-to-watchlist-item]')
        .contains('Toggle from the media page')
        .should('have.attr', 'data-added', 'true')
        .click();
      cy.get('[data-testid=add-to-watchlist-item]')
        .contains('Toggle from the media page')
        .should('have.attr', 'data-added', 'false');

      cy.request(`/api/v1/mediaLists/${listId}/items`)
        .its('body')
        .should('have.length', 0);
    });
  });

  describe('a list with titles on it', () => {
    beforeEach(function () {
      createList('Sunday Night Sci-Fi', 'Slow burn').then((listId: number) => {
        cy.wrap(listId).as('listId');
        addItem(listId, MOVIE.tmdbId, 'movie');
        addItem(listId, SERIES.tmdbId, 'tv');
      });
    });

    it('shows the titles with artwork resolved from tmdb', function () {
      cy.visit(`/watchlists/${this.listId}`);

      cy.get('[data-testid=watchlist-item]').should('have.length', 2);
      openCard(MOVIE.tmdbId).should('contain', MOVIE.title);
      openCard(SERIES.tmdbId).should('contain', SERIES.title);
    });

    it('marks a movie seen and filters by it', function () {
      cy.visit(`/watchlists/${this.listId}`);

      openCard(MOVIE.tmdbId)
        .find('[data-testid=watchlist-item-seen-toggle]')
        .click();

      // A movie's seen picto is its own toggle now: the same button reports the
      // state via aria-pressed rather than a separate always-on badge.
      card(MOVIE.tmdbId)
        .find('[data-testid=watchlist-item-seen-toggle]')
        .should('have.attr', 'aria-pressed', 'true');

      cy.get('[data-testid=watchlist-filter-seen]').click();
      cy.get('[data-testid=watchlist-item]').should('have.length', 1);
      card(MOVIE.tmdbId).should('exist');

      cy.get('[data-testid=watchlist-filter-unseen]').click();
      card(SERIES.tmdbId).should('exist');
      card(MOVIE.tmdbId).should('not.exist');
    });

    it('tracks episodes and derives the season and show state', function () {
      cy.visit(`/watchlists/${this.listId}`);

      openCard(SERIES.tmdbId)
        .find('[data-testid=watchlist-item-episodes]')
        .click();

      cy.get('[data-testid=watchlist-season]').should(
        'have.length.at.least',
        2
      );

      // A season nobody has started still knows its episode total, which is what makes
      // the ring read 0/10 rather than 0/0.
      cy.get('[data-testid=watchlist-season]')
        .first()
        .should('contain', 'episodes')
        .and('contain', '0 seen');

      cy.get('[data-testid=watchlist-season]')
        .first()
        .contains('button', 'Mark Season Seen')
        .click();

      cy.get('[data-testid=watchlist-season]')
        .first()
        .should('contain', 'All Seen');

      // The show is only finished when every season is, so one season is not enough.
      cy.get('[data-testid=watchlist-item-seen]').should('not.exist');
      openCard(SERIES.tmdbId).should('contain', 'episodes');
    });

    it('ticks a single episode from the checklist', function () {
      cy.visit(`/watchlists/${this.listId}`);

      openCard(SERIES.tmdbId)
        .find('[data-testid=watchlist-item-episodes]')
        .click();

      cy.get('[data-testid=watchlist-season-toggle]').first().click();
      cy.get('[data-testid=watchlist-episode]').should(
        'have.length.at.least',
        1
      );
      cy.get('[data-testid=watchlist-episode]').first().click();

      cy.get('[data-testid=watchlist-season]')
        .first()
        .should('contain', '1 seen');

      // The accordion has to survive the write that the tick triggers, or every episode
      // costs the reader their place.
      cy.get('[data-testid=watchlist-episode]').should(
        'have.length.at.least',
        1
      );
    });

    it('offers the existing request flow on a title', function () {
      cy.visit(`/watchlists/${this.listId}`);

      openCard(MOVIE.tmdbId).contains('button', 'Request').click();

      // The request modal is the app's own, reused rather than reimplemented.
      cy.get('[data-testid=modal-title]').should('contain', 'Request');
      cy.contains('button', 'Cancel').click();
    });

    it('pins a title to the top and unpins it, on the detail page', function () {
      cy.visit(`/watchlists/${this.listId}`);

      // Added second, so it starts behind the movie until it is pinned.
      cy.get('[data-testid=watchlist-item]')
        .eq(1)
        .should('have.attr', 'data-tmdb-id', String(SERIES.tmdbId));

      openCard(SERIES.tmdbId)
        .find('[data-testid=watchlist-pin-toggle]')
        .click();

      cy.get('[data-testid=watchlist-item]')
        .eq(0)
        .should('have.attr', 'data-tmdb-id', String(SERIES.tmdbId));
      card(SERIES.tmdbId)
        .find('[data-testid=watchlist-pin-toggle]')
        .should('have.attr', 'aria-pressed', 'true');

      openCard(SERIES.tmdbId)
        .find('[data-testid=watchlist-pin-toggle]')
        .click();

      card(SERIES.tmdbId)
        .find('[data-testid=watchlist-pin-toggle]')
        .should('have.attr', 'aria-pressed', 'false');
      cy.get('[data-testid=watchlist-item]')
        .eq(1)
        .should('have.attr', 'data-tmdb-id', String(SERIES.tmdbId));
    });
  });

  describe('sharing', () => {
    beforeEach(function () {
      createList('Film club', 'One pick each per month').then(
        (listId: number) => {
          cy.wrap(listId).as('listId');
          addItem(listId, MOVIE.tmdbId, 'movie');
        }
      );
    });

    it('shares a list and shows who has access', function () {
      cy.visit(`/watchlists/${this.listId}`);

      cy.contains('button', 'Share').click();
      cy.get('[data-testid=modal-title]').should('contain', 'Share Watchlist');

      // react-select puts the caret in its own input, not the container.
      cy.get('.react-select-container').click();
      cy.get('input[id^=react-select]').type('friend');
      cy.get('[class*="react-select__option"]').contains('friend').click();
      cy.contains('button', 'Invite').click();

      // The owner is listed above the collaborators but is not one of them, so there is
      // a single collaborator row here rather than two.
      cy.get('[data-testid=watchlist-collaborator]')
        .should('have.length', 1)
        .and('contain', 'friend')
        .and('contain', 'Can view');
      cy.contains('People with Access')
        .parent()
        .should('contain', 'admin')
        .and('contain', 'Owner');
      cy.contains('Only admin can delete this watchlist');
    });

    it('gives a read collaborator their own state but not the list', function () {
      shareWithFriend(this.listId, 'read');

      cy.loginAsUser();
      acceptInviteViaApi(this.listId);
      cy.visit('/watchlists');

      // Shared and owned lists live in one section; the role badge is what tells
      // them apart, and this account is a mere viewer of this one.
      cy.get('[data-testid=watchlist-shelf]')
        .should('contain', 'Film club')
        .and('contain', 'Can View');

      cy.visit(`/watchlists/${this.listId}`);
      cy.contains('button', 'Add Media').should('not.exist');
      cy.contains('button', 'Share').should('not.exist');

      // Recording what you watched is not editing the list, so it stays available.
      openCard(MOVIE.tmdbId)
        .find('[data-testid=watchlist-item-seen-toggle]')
        .click();
      card(MOVIE.tmdbId)
        .find('[data-testid=watchlist-item-seen-toggle]')
        .should('have.attr', 'aria-pressed', 'true');

      // Pinning edits the shared list, so it stays absent rather than disabled.
      card(MOVIE.tmdbId)
        .find('[data-testid=watchlist-pin-toggle]')
        .should('not.exist');
    });

    it('lets a write collaborator add a title but never delete the list', function () {
      shareWithFriend(this.listId, 'write');

      cy.loginAsUser();
      acceptInviteViaApi(this.listId);
      cy.visit(`/watchlists/${this.listId}`);

      cy.contains('button', 'Add Media').should('exist');
      // Deleting stays with the author however much else a collaborator can do.
      cy.contains('button', 'Share').should('not.exist');
      cy.contains('button', 'Edit').click();
      cy.contains('button', 'Delete List').should('not.exist');
    });

    it('shows a write collaborator who has access, on the shelf and the detail page', function () {
      shareWithFriend(this.listId, 'write');

      cy.loginAsUser();
      acceptInviteViaApi(this.listId);

      // The shelf row is the first place this list shows up for a collaborator, and
      // it has to name the owner too, not just show nothing.
      cy.visit('/watchlists');
      cy.get('[data-testid=watchlist-shelf]')
        .contains('Film club')
        .parents('[data-testid=watchlist-shelf]')
        .find('[data-testid=watchlist-shared-with-avatar]')
        .should('have.length', 1)
        .and('have.attr', 'title', 'admin');

      // No management UI on the detail page either, but the owner's avatar is still
      // visible there: seeing who has access is not the same permission as managing it.
      cy.visit(`/watchlists/${this.listId}`);
      cy.contains('button', 'Share').should('not.exist');
      cy.get('[data-testid=watchlist-shared-with-avatar]')
        .should('have.length', 1)
        .and('have.attr', 'title', 'admin');
    });

    it('withholds access until the invite is accepted through the Invites card', function () {
      shareWithFriend(this.listId, 'read');

      cy.loginAsUser();
      cy.visit('/watchlists');

      // Not accepted yet, so it must not read as a list the friend already has. The
      // friend owns nothing either, so the empty state renders and no shelf exists yet.
      cy.get('[data-testid=watchlist-shelf]').should('not.exist');

      cy.get('[data-testid=watchlist-invite-card]')
        .should('have.length', 1)
        .and('contain', 'Film club')
        .and('contain', 'admin');
      cy.get('[data-testid=watchlist-invite-card]')
        .contains('button', 'Accept')
        .click();

      cy.get('[data-testid=watchlist-invite-card]').should('not.exist');
      cy.get('[data-testid=watchlist-shelf]').should('contain', 'Film club');
    });

    it('rejecting an invite is final, and the owner can invite again', function () {
      shareWithFriend(this.listId, 'read');

      cy.loginAsUser();
      cy.visit('/watchlists');

      cy.get('[data-testid=watchlist-invite-card]')
        .contains('button', 'Reject')
        .click();

      cy.get('[data-testid=watchlist-invite-card]').should('not.exist');
      cy.get('[data-testid=watchlist-shelf]').should('not.exist');

      cy.loginAsAdmin();
      shareWithFriend(this.listId, 'write');

      cy.loginAsUser();
      cy.visit('/watchlists');
      cy.get('[data-testid=watchlist-invite-card]')
        .should('have.length', 1)
        .and('contain', 'Film club');
    });
  });
});
