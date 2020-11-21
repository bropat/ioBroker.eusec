![Logo](admin/eufy-security.png)
# ioBroker.eufy-security

[![NPM version](http://img.shields.io/npm/v/iobroker.eufy-security.svg)](https://www.npmjs.com/package/iobroker.eufy-security)
[![Downloads](https://img.shields.io/npm/dm/iobroker.eufy-security.svg)](https://www.npmjs.com/package/iobroker.eufy-security)
![Number of Installations (latest)](http://iobroker.live/badges/eufy-security-installed.svg)
![Number of Installations (stable)](http://iobroker.live/badges/eufy-security-stable.svg)
[![Dependency Status](https://img.shields.io/david/bropat/iobroker.eufy-security.svg)](https://david-dm.org/bropat/iobroker.eufy-security)
[![Known Vulnerabilities](https://snyk.io/test/github/bropat/ioBroker.eufy-security/badge.svg)](https://snyk.io/test/github/bropat/ioBroker.eufy-security)

[![NPM](https://nodei.co/npm/iobroker.eufy-security.png?downloads=true)](https://nodei.co/npm/iobroker.eufy-security/)

The development of this adapter was only possible thanks to the work of the following people:

* FuzzyMistborn (https://github.com/FuzzyMistborn/python-eufy-security)
* keshavdv (https://github.com/keshavdv/python-eufy-security)
* JanLoebel (https://github.com/JanLoebel/eufy-node-client)

Credits goes to them.

## Description

This adapter allows to control Eufy security devices by connecting to the Eufy cloud servers.

You need to provide your Cloud login credentials. The adapter connects to your cloud account and polls for all device data via HTTPS. Because of this the devices need to be connected to their cloud. Currently no way is known to control the devices locally.

One Adapter instance will show all devices from one Eufy Cloud account and allows to control them.

## Features

* Base station:
    * Change guard mode
* Camera:
    * Start livestream (rtmp)
    * Stop livestream (rtmp)
* Two factor authentication (token renewal needs manual intervention)
* Push notification support
* Basic P2P communication functionality:
    * event: Alarm mode change
* more to come...

## Known working devices

* HomeBase 2 (T8010)
* eufyCam 2 (T8114)
* eufyCam2C (T8113)
* Eufy Battery Doorbell (T8210)

If more devices work (or also not) please report them by opening a GitHub issue.

## How to report issues and feature requests

Please use GitHub issues for this.

Best is to set the adapter to Debug log mode (Instances -> Expert mode -> Column Log level). Then please get the logfile from disk (subdirectory "log" in ioBroker installation directory and not from Admin because Admin cuts the lines).

## Changelog

### 0.0.3
* (bropat) Fixed issue with push notification credentials initialization

### 0.0.2
* (bropat) Added push notification support for event notification (raw notifications!)
* (bropat) Added 2FA (token renewal needs manual intervention)
* (bropat) Added P2P communication with station (event: Alarm mode change)
* (bropat) Added more device classes (sensors, locks, keypads) with no actions (at the moment! WIP!)
* (bropat) Added all eufy camera devices release to date
* (bropat) Added battery state to eufy cameras

### 0.0.1
* (bropat) initial release

## License
MIT License

Copyright (c) 2020 bropat <patrick.broetto@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.