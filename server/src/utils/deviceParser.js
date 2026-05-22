'use strict';

const UAParser = require('ua-parser-js');

const parseDeviceName = (userAgent) => {
  if (!userAgent) return 'Unknown device';
  const ua = new UAParser(userAgent);
  const browser = ua.getBrowser().name || 'Unknown browser';
  const os = ua.getOS().name || 'Unknown OS';
  const osVersion = ua.getOS().version || '';
  return `${browser} on ${os}${osVersion ? ' ' + osVersion : ''}`;
};

module.exports = { parseDeviceName };
