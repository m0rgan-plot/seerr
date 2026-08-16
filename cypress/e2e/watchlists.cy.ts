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

const openCard = (tmdbId: number) => {
  card(tmdbId)
    .find('[data-testid=watchlist-item-poster]')
    .trigger('mouseenter');
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
      cy.contains('button', 'Add').click();
      cy.contains('button', 'Added').should('exist');
      cy.get('[data-testid=modal-ok-button]').click();

      cy.get('[data-testid=watchlist-shelf] button[title^="Share"]').click();
      cy.get('[data-testid=modal-title]')
        .should('have.length', 1)
        .and('contain', 'Share Watchlist');
      cy.contains('People with Access').should('exist');

      cy.request(`/api/v1/mediaLists/${listId}/items`)
        .its('body')
        .should('have.length', 1);
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

      card(MOVIE.tmdbId)
        .find('[data-testid=watchlist-item-seen]')
        .should('exist');

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
        .and('contain', 'Can View');
      cy.contains('People with Access')
        .parent()
        .should('contain', 'admin')
        .and('contain', 'Owner');
      cy.contains('Only admin can delete this watchlist');
    });

    it('gives a read collaborator their own state but not the list', function () {
      shareWithFriend(this.listId, 'read');

      cy.loginAsUser();
      cy.visit('/watchlists');

      // A shared list is filed separately from the ones you own.
      cy.contains('Shared with Me');
      cy.get('[data-testid=watchlist-shelf]').should('contain', 'Film club');

      cy.visit(`/watchlists/${this.listId}`);
      cy.contains('button', 'Add Media').should('not.exist');
      cy.contains('button', 'Share').should('not.exist');

      // Recording what you watched is not editing the list, so it stays available.
      openCard(MOVIE.tmdbId)
        .find('[data-testid=watchlist-item-seen-toggle]')
        .click();
      card(MOVIE.tmdbId)
        .find('[data-testid=watchlist-item-seen]')
        .should('exist');
    });

    it('lets a write collaborator add a title but never delete the list', function () {
      shareWithFriend(this.listId, 'write');

      cy.loginAsUser();
      cy.visit(`/watchlists/${this.listId}`);

      cy.contains('button', 'Add Media').should('exist');
      // Deleting stays with the author however much else a collaborator can do.
      cy.contains('button', 'Share').should('not.exist');
      cy.contains('button', 'Edit').click();
      cy.contains('button', 'Delete List').should('not.exist');
    });
  });
});
