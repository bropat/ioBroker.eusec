# Features

* Supports local and remote p2p connection to station
* Two factor authentication
* Livestream as HLS stream (supports all platforms, but introduce a latency)
* Last HLS live stream is always saved for later viewing
* Downloads event video when push notification is received (async)
* Takes jpeg thumbnail of the livestream or downloaded video
* Base station:
  * States:
    * Configured Guard mode
    * Current Guard mode
    * Name
    * Model
    * Serial number
    * Software version
    * Hardware version
    * MAC address
    * LAN ip address
  * Actions:
    * Change guard mode
    * Trigger alarm sound
    * Reset alarm sound
    * Reboot station
  * Events:
    * Alarm mode change
* Camera:
  * States:
    * Online / offline etc.
    * Battery %
    * Battery temperature
    * Name
    * Model
    * Serial number
    * Software version
    * Hardware version
    * MAC address
    * Wifi RSSI
    * Filtered false events since last charge
    * Saved/Recorded events since last charge
    * Total events since last charge
    * Used days since last charge
    * And lot's more...
  * Actions:
    * Start livestream (hls; supports also local livestream)
    * Stop livestream (hls)
    * Enable/disable device
    * Enable/disable auto night vision
    * Enable/disable led (only camera 2 products, indoor cameras, floodlight camera, solo cameras and doorbells)
    * Enable/disable anti-theft detection (only camera 2 products)
    * Enable/disable motion detection
    * Enable/disable pet detection (only indoor cameras)
    * Enable/disable sound detection (only indoor cameras)
    * Enable/disable RTSP stream (only camera2 products, indoor cameras and solo cameras)
    * Change video watermark setting
    * And lot's more...
  * Events:
    * Motion detected
    * Person detected
    * Ringing (only Doorbell)
    * Crying detected (only Indoor cameras)
    * Sound detected (only Indoor cameras)
    * Pet detected (only Indoor cameras)
* Sensor:
  * Entry sensor:
    * States:
      * Online / offline etc.
      * Low battery
      * Name
      * Model
      * Serial number
      * Software version
      * Hardware version
    * Events:
      * Open / closed
  * Motion sensor:
    * States:
      * Online / offline etc.
      * Low battery
      * Name
      * Model
      * Serial number
      * Software version
      * Hardware version
    * Events:
      * Motion detected
* Keypad:
  * States:
    * Online / offline etc.
    * Low battery
    * Name
    * Model
    * Serial number
    * Software version
    * Hardware version
* Lock:
  * States:
    * Online / offline etc.
    * Battery %
    * Lock status
    * Name
    * Model
    * Serial number
    * Software version
    * Hardware version
    * Wifi RSSI
  * Actions:
    * Lock/unlock
* more to come...