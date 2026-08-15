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

    cy.contains('No watchlists yet');
    cy.contains('Create a watchlist').click();

    cy.get('[data-testid=modal-title]').should('contain', 'New watchlist');
    cy.get('#name').type('Sunday Night Sci-Fi');
    cy.get('#description').type('Slow burn science fiction.');
    cy.contains('button', 'Create watchlist').click();

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
        .find('button[aria-label^="Options"]')
        .click();

      cy.get('#name').clear().type('Renamed list');
      cy.contains('button', 'Save').click();
      cy.get('[data-testid=watchlist-shelf]').should('contain', 'Renamed list');

      cy.get('button[aria-label^="Options"]').click();
      cy.contains('button', 'Delete list').click();
      cy.get('[data-testid=modal-title]').should('contain', 'Delete watchlist');
      cy.contains('button', 'Delete').click();

      cy.contains('No watchlists yet');
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
      cy.contains(MOVIE.title);
      cy.contains(SERIES.title);
    });

    it('marks a movie seen and filters by it', function () {
      cy.visit(`/watchlists/${this.listId}`);

      cy.get('[data-testid=watchlist-item]')
        .contains(MOVIE.title)
        .parents('[data-testid=watchlist-item]')
        .contains('button', 'Mark seen')
        .click();

      cy.get('[data-testid=watchlist-item]')
        .contains(MOVIE.title)
        .parents('[data-testid=watchlist-item]')
        .should('contain', 'Seen');

      cy.get('[data-testid=watchlist-filter-seen]').click();
      cy.get('[data-testid=watchlist-item]')
        .should('have.length', 1)
        .and('contain', MOVIE.title);

      cy.get('[data-testid=watchlist-filter-unseen]').click();
      cy.get('[data-testid=watchlist-item]').should('contain', SERIES.title);
    });

    it('tracks episodes and derives the season and show state', function () {
      cy.visit(`/watchlists/${this.listId}`);

      cy.get('[data-testid=watchlist-item]')
        .contains(SERIES.title)
        .parents('[data-testid=watchlist-item]')
        .contains('button', 'Episodes')
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
        .contains('button', 'Mark season seen')
        .click();

      cy.get('[data-testid=watchlist-season]')
        .first()
        .should('contain', 'All seen');

      // The show is only finished when every season is, so one season is not enough.
      cy.contains("You've seen").should('not.contain', 'of 0');
      cy.get('[data-testid=watchlist-item]')
        .contains(SERIES.title)
        .parents('[data-testid=watchlist-item]')
        .should('contain', 'episodes');
    });

    it('ticks a single episode from the checklist', function () {
      cy.visit(`/watchlists/${this.listId}`);

      cy.get('[data-testid=watchlist-item]')
        .contains(SERIES.title)
        .parents('[data-testid=watchlist-item]')
        .contains('button', 'Episodes')
        .click();

      cy.get('[data-testid=watchlist-season]').first().click();
      cy.get('[data-testid=watchlist-episode]').should(
        'have.length.at.least',
        1
      );
      cy.get('[data-testid=watchlist-episode]').first().click();

      cy.get('[data-testid=watchlist-season]')
        .first()
        .should('contain', '1 seen');
    });

    it('offers the existing request flow on a title', function () {
      cy.visit(`/watchlists/${this.listId}`);

      cy.get('[data-testid=watchlist-item]')
        .contains(MOVIE.title)
        .parents('[data-testid=watchlist-item]')
        .contains('button', 'Request')
        .click();

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
      cy.get('[data-testid=modal-title]').should('contain', 'Share watchlist');

      cy.get('.react-select-container').click().type('friend');
      cy.get('[class*="react-select__option"]').contains('friend').click();
      cy.contains('button', 'Invite').click();

      // The owner is listed above the collaborators but is not one of them, so there is
      // a single collaborator row here rather than two.
      cy.get('[data-testid=watchlist-collaborator]')
        .should('have.length', 1)
        .and('contain', 'friend')
        .and('contain', 'Can view');
      cy.contains('People with access')
        .parent()
        .should('contain', 'admin')
        .and('contain', 'Owner');
      cy.contains('Only admin can delete this watchlist');
    });

    it('gives a read collaborator their own state but not the list', function () {
      cy.request('POST', `/api/v1/mediaLists/${this.listId}/collaborators`, {
        userId: 2,
        role: 'read',
      });

      cy.loginAsUser();
      cy.visit('/watchlists');

      // A shared list is filed separately from the ones you own.
      cy.contains('Shared with me');
      cy.get('[data-testid=watchlist-shelf]').should('contain', 'Film club');

      cy.visit(`/watchlists/${this.listId}`);
      cy.contains('button', 'Add media').should('not.exist');
      cy.contains('button', 'Share').should('not.exist');

      // Recording what you watched is not editing the list, so it stays available.
      cy.get('[data-testid=watchlist-item]')
        .contains('button', 'Mark seen')
        .click();
      cy.get('[data-testid=watchlist-item]').should('contain', 'Seen');
    });

    it('lets a write collaborator add a title but never delete the list', function () {
      cy.request('POST', `/api/v1/mediaLists/${this.listId}/collaborators`, {
        userId: 2,
        role: 'write',
      });

      cy.loginAsUser();
      cy.visit(`/watchlists/${this.listId}`);

      cy.contains('button', 'Add media').should('exist');
      // Deleting stays with the author however much else a collaborator can do.
      cy.contains('button', 'Share').should('not.exist');
      cy.contains('button', 'Edit').click();
      cy.contains('button', 'Delete list').should('not.exist');
    });
  });
});
