# sendTo

Below you will find all commands that are supported via sendTo with a respective call example.

## snooze

Snooze the device for the specified time and mode.

  | Parameter | Type | Required | Description |
  | - | - | - | - |
  | station_sn | string | yes | Station serial number |
  | device_sn | string | yes | Device serial number |
  | snooze_time | number | yes | snooze time in seconds or 0 to disable already configured snooze time |
  | snooze_chime | boolean | no | If true snoozes the doorbell chime (only for supported devices) |
  | snooze_homebase | boolean | no | If true snoozes the homebase (only for supported devices) |
  | snooze_motion | boolean | no | If true snoozes the motion detection (only for supported devices) |

If a callback function is specified the returning result is of the following format:

```javascript
{
    sended: boolean;
    result: string;
}
```

Example:

```javascript
sendTo('eusec.0', 'snooze', {
    station_sn: "T8410PXXXXXXXXXX",
    device_sn: "T8410PXXXXXXXXXX",
    snooze_time: 30,
    snooze_chime: true,
    snooze_homebase: true,
    snooze_motion: true
}, async function (result) {
      console.log(result);
});
```

## quickResponse

Send a quick response message to the device (only for supported devices).

  | Parameter | Type | Required | Description |
  | - | - | - | - |
  | station_sn | string | yes | Station serial number |
  | device_sn | string | yes | Device serial number |
  | voice_id | number | yes | Voice Id of the recorded response. You can get this Id using the command `getQuickResponseVoices` |

If a callback function is specified the returning result is of the following format:

```javascript
{
    sended: boolean;
    result: string;
}
```

Example:

```javascript
sendTo('eusec.0', 'quickResponse', {
    station_sn: "T8023XXXXXXXXXXX",
    device_sn: "T8214XXXXXXXXXXX",
    voice_id: 1,
}, async function (result) {
      console.log(result);
});
```

## getQuickResponseVoices

Get quick response voice id's from the device (only for supported devices).

  | Parameter | Type | Required | Description |
  | - | - | - | - |
  | device_sn | string | yes | Device serial number |

If a callback function is specified the returning result is of the following format:

```javascript
{
    sended: boolean;
    result: Array<{
        voice_id: number;
        user_id: string;
        desc: string;
        device_sn: string;
        voice_link: string;
        voice_type: number;
        key_prefix: string;
    }>;
}
```

Example:

```javascript
sendTo('eusec.0', 'getQuickResponseVoices', {
    device_sn: "T8214XXXXXXXXXXX",
}, async function (result) {
    for (voice of result) {
        console.log(`voice - id: ${voice.voice_id} desc: ${voice.desc}`);
    }
});
```

## chime

Send a chime message to the device (only for supported devices).

  | Parameter | Type | Required | Description |
  | - | - | - | - |
  | station_sn | string | yes | Station serial number |
  | ringtone | number | no | Ringtone Id |

If a callback function is specified the returning result is of the following format:

```javascript
{
    sended: boolean;
    result: string;
}
```

Example:

```javascript
sendTo('eusec.0', 'chime', {
    station_sn: "T8010XXXXXXXXXXX",
    ringtone: 0,
}, async function (result) {
      console.log(result);
});
```

## pollRefresh

Force refresh of Eufy cloud data.

If a callback function is specified the returning result is of the following format:

```javascript
{
    sended: boolean;
    result: string;
}
```


Example:

```javascript
sendTo('eusec.0', 'pollRefresh', undefined, async function (result) {
      console.log(result);
});
```