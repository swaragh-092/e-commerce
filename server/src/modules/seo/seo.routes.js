'use strict';

const express = require('express');
const seoController = require('./seo.controller');

const router = express.Router();

router.get('/sitemap.xml', seoController.getSitemap);
router.get('/robots.txt', seoController.getRobots);

module.exports = router;
