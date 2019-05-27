```
{
  "payload": {
    "capacity": {
      "2": 0					// 稼働率
    },
    "rssi": {
      "2": 206
    },
    "timestamp": 1432306800028,
    "type": "hour",
    "vbat": {
      "2": 3.2
    }
  },
  "timestamp": 1432306800028,
  "type": "hour"
}
```


- timestamp
timestampは稼働率の時刻+1H+GWIDになる。
2019年5月24日 AM8:00の稼働率は、下記のとおりとなる。
(getMonth()は0-11のため4になる)

```
var gwid = 001;
console.log((new Date(2019,4,24,8+1)).getTime()+gwid);
```

1558656000001

- capacityは稼働率そのものを示す
