const express = require('express');
const { isWebUri } = require('valid-url');
const xss = require('xss');
const logger = require('../logger');
const BookmarksService = require('./bookmarks-service');

const bookmarksRouter = express.Router();
const bodyParser = express.json();

const serializeBookmark = (bookmark) => ({
  id: bookmark.id,
  title: xss(bookmark.title),
  url: bookmark.url,
  description: xss(bookmark.description),
  rating: Number(bookmark.rating),
});

let store;

bookmarksRouter
  .route('/bookmarks')
  .get((req, res, next) => {
    const db = req.app.get('db');
    BookmarksService.getAllBookmarks(db)
      .then((bookmarks) => {
        res.json(bookmarks.map(serializeBookmark));
      })
      .catch(next);
  })
  .post(bodyParser, (req, res, next) => {
    const db = req.app.get('db');
    for (const field of ['title', 'url', 'rating']) {
      if (!req.body[field]) {
        logger.error(`${field} is required`);
        return res.status(400).send(`'${field}' is required`);
      }
    }
    const { title, url, description, rating } = req.body;

    if (!Number.isInteger(rating) || rating < 0 || rating > 5) {
      logger.error(`Invalid rating '${rating}' supplied`);
      return res.status(400).send(`'rating' must be a number between 0 and 5`);
    }

    if (!isWebUri(url)) {
      logger.error(`Invalid url '${url}' supplied`);
      return res.status(400).send(`'url' must be a valid URL`);
    }

    let bookmark = { title, url, description, rating };
    bookmark = serializeBookmark(bookmark);

    BookmarksService.insertBookmark(db, bookmark)
      .then((results) => {
        logger.info(`Bookmark with id ${results.id} created`);
        res
          .status(201)
          .location(`http://localhost:8000/bookmarks/${results.id}`)
          .json(results);
      })
      .catch(next);
  });

bookmarksRouter
  .route('/bookmarks/:bookmark_id')
  .get((req, res, next) => {
    const db = req.app.get('db');
    const { bookmark_id } = req.params;
    BookmarksService.getById(db, bookmark_id)
      .then((bookmark) => {
        if (!bookmark) {
          logger.error(`Bookmark with id ${bookmark_id} not found.`);
          return res.status(404).json({
            error: { message: `Bookmark Not Found` },
          });
        }
        res.json(serializeBookmark(bookmark));
      })
      .catch(next);
  })
  .delete((req, res, next) => {
    const db = req.app.get('db');
    const { bookmark_id } = req.params;
    console.log('bookmark id:', bookmark_id);
    BookmarksService.getById(db, bookmark_id).then((results) => {
      if (!results) {
        logger.error(`Bookmark with id ${bookmark_id} not found.`);
        return res.status(404).send('Bookmark Not Found');
      }
    });

    BookmarksService.deleteBookmark(db, bookmark_id)
      .then(() => {
        logger.info(`Bookmark with id ${bookmark_id} deleted.`);
        res.status(204).end();
      })
      .catch(next);
  });

module.exports = bookmarksRouter;
