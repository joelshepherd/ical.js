suite('recur_iterator', function() {
  suite('initialization', function() {
    test('missing rule', function() {
      assert.throws(function() {
        new ICAL.RecurIterator({
          dtstart: ICAL.Time.fromString('2015-01-01T01:01:01')
        });
      }, "iterator requires a (ICAL.Recur) rule");
    });
    test('missing dtstart', function() {
      assert.throws(function() {
        new ICAL.RecurIterator({
          rule: new ICAL.Recur()
        });
      }, "iterator requires a (ICAL.Time) dtstart");
    });
  });
  suite('#toString', function() {
    test('contains important properties', function() {
      var start = ICAL.Time.fromString('2012-02-01T09:00:00');
      recur = ICAL.Recur.fromString('FREQ=MONTHLY;COUNT=12;INTERVAL=3');
      iterator = recur.iterator(start);
      iterator.next();

      var str = iterator.toString();
      assert.include(str, "RULE: FREQ=MONTHLY;COUNT=12;INTERVAL=3");
      assert.include(str, "DTSTART: 2012-02-01T09:00:00");
      assert.include(str, "2012-02-01T09:00:00");
      assert.include(str, "BYMONTH: 1,*2,3,4,5,6,7,8,9,10,11,12");
      assert.include(str, "BYMONTHDAY: *1");
      assert.include(str, "BYHOUR: *9");
      assert.include(str, "BYMINUTE: *0");
      assert.include(str, "BYSECOND: *0");
    });
  });
  suite('#toJSON', function() {
    var recur, iterator;

    setup(function() {
      var start = ICAL.Time.fromString('2012-02-01T09:00:00');
      recur = ICAL.Recur.fromString('FREQ=MONTHLY;COUNT=12;INTERVAL=3');
      iterator = recur.iterator(start);
    });

    test('completed', function() {
      var next;
      while (iterator.next()) {}

      assert.isTrue(iterator.completed, 'is completed');

      var json = iterator.toJSON();
      var newIter = new ICAL.RecurIterator(json);

      assert.equal(newIter.next(), null, 'new iter next');
      assert.isTrue(newIter.completed, true, 'new iter completed');
    });

    test('INTERVAL: mid iteration (two iterations)', function() {
      iterator.next();
      iterator.next();

      var json = iterator.toJSON();
      var newIter = new ICAL.RecurIterator(json);
      var inc = 0;

      while (inc++ < 8) {
        assert.deepEqual(
          iterator.next().toJSDate(),
          newIter.next().toJSDate(),
          'failed #' + inc
        );
      }
    });

    test('from the begining of iteration', function() {
      var expected = {
        initialized: true,
        completed: false,
        rule: iterator.rule.toJSON(),
        dtstart: iterator.dtstart.toJSON(),
        by_data: iterator.by_data,
        last: null,
        occurrence_number: iterator.occurrence_number,
        yearlyWithBydayPrefix: iterator.yearlyWithBydayPrefix,

        by_iter: {
          BYMONTH: { arr: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], idx: 0, wrapped: false },
          BYMONTHDAY: { arr: [1], idx: 0, wrapped: true },
          BYDAY: { arr: [[0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 1]], idx: 0, wrapped: false },
          BYHOUR: { arr: [9], idx: 0, wrapped: true },
          BYMINUTE: { arr: [0], idx: 0, wrapped: true },
          BYSECOND: { arr: [0], idx: 0, wrapped: true }
        },

        by_cache_year: 0,
        by_cache: []
      };

      var json = iterator.toJSON();
      assert.deepEqual(json, expected);

      var newIter = new ICAL.RecurIterator(json);
      var inc = 0;

      while (inc++ < 10) {
        assert.deepEqual(
          newIter.next().toJSDate(),
          iterator.next().toJSDate(),
          'iterator equality #' + inc
        );
      }
    });

    test('cached occurrences', function() {
      iterator.next();
      var json = iterator.toJSON();
      json.by_cache = [
        '2012-05-01T09:00:00',
        // skipping this one, for the test: '2012-08-01T09:00:00'
        '2012-11-01T09:00:00'
      ];
      var newIter = new ICAL.RecurIterator(json);

      assert.equal(newIter.next().toString(), '2012-05-01T09:00:00');
      assert.equal(newIter.next().toString(), '2012-11-01T09:00:00');
    });

  });

  suite('ByComponentIterator', function() {
    var ByComponentIterator = ICAL.RecurIterator._ByComponentIterator;

    test('initialization', function() {
      var it = new ByComponentIterator([1,2,3]);
      assert.deepEqual(it.arr, [1,2,3]);
      assert.equal(it.idx, 0);
      assert.isFalse(it.wrapped);

      it = new ByComponentIterator([1]);
      assert.deepEqual(it.arr, [1]);
      assert.equal(it.idx, 0);
      assert.isTrue(it.wrapped);
    });
    test('#_postitiveArr', function() {
      var it = new ByComponentIterator([1,-2,3]);
      it.max = 3;
      assert.deepEqual(it._positiveArr, [1,2,3]);
    });

    test('#max', function() {
      var it = new ByComponentIterator([1,-2,3]);
      it.max = 3;
      assert.deepEqual(it.arr, [1,-2,3]);

      it.max = 5;
      assert.deepEqual(it.arr, [1,3,-2]);

      // don't sort when value doesn't change
      it.arr = [1,-2,3];
      it.max = 5;
      assert.deepEqual(it.arr, [1,-2,3]);
      assert.equal(it.max, 5);
    });

    test('#has', function() {
      var it = new ByComponentIterator([1,-2,3]);
      assert.isFalse(it.has(2));

      it.max = 3;
      assert.isTrue(it.has(2));
      assert.isTrue(it.has(1));
      assert.isTrue(it.has(-3));
    });
    test('#next', function() {
      var it = new ByComponentIterator([1,-2,3]);
      assert.equal(it.peek(), 1);
      assert.equal(it.peekNext(), -2);
      assert.equal(it.peekPrev(), 3);
      assert.isFalse(it.prevWraps);
      assert.isFalse(it.wrapped);
      assert.isFalse(it.nextWraps);

      it.next();
      assert.equal(it.peek(), -2);
      assert.equal(it.peekNext(), 3);
      assert.equal(it.peekPrev(), 1);
      assert.isTrue(it.prevWraps);
      assert.isFalse(it.wrapped);
      assert.isFalse(it.nextWraps);

      it.next();
      assert.equal(it.peek(), 3);
      assert.equal(it.peekNext(), 1);
      assert.equal(it.peekPrev(), -2);
      assert.isFalse(it.prevWraps);
      assert.isFalse(it.wrapped);
      assert.isTrue(it.nextWraps);

      it.next();
      assert.equal(it.peek(), 1);
      assert.equal(it.peekNext(), -2);
      assert.equal(it.peekPrev(), 3);
      assert.isFalse(it.prevWraps);
      assert.isTrue(it.wrapped);
      assert.isFalse(it.nextWraps);
    });
    test('#prev', function() {
      var it = new ByComponentIterator([1,-2,3]);
      assert.equal(it.peek(), 1);
      assert.equal(it.peekNext(), -2);
      assert.equal(it.peekPrev(), 3);
      assert.isFalse(it.prevWraps);
      assert.isFalse(it.wrapped);
      assert.isFalse(it.nextWraps);

      it.prev();
      assert.equal(it.peek(), 3);
      assert.equal(it.peekNext(), 1);
      assert.equal(it.peekPrev(), -2);
      assert.isFalse(it.prevWraps);
      assert.isTrue(it.wrapped);
      assert.isTrue(it.nextWraps);

      it.prev();
      assert.equal(it.peek(), -2);
      assert.equal(it.peekNext(), 3);
      assert.equal(it.peekPrev(), 1);
      assert.isTrue(it.prevWraps);
      assert.isFalse(it.wrapped);
      assert.isFalse(it.nextWraps);

      it.prev();
      assert.equal(it.peek(), 1);
      assert.equal(it.peekNext(), -2);
      assert.equal(it.peekPrev(), 3);
      assert.isFalse(it.prevWraps);
      assert.isFalse(it.wrapped);
      assert.isFalse(it.nextWraps);
    });
    test('#toJSON', function() {
      var it = new ByComponentIterator([1,-2,3]);
      assert.deepEqual(it.toJSON(), {
        arr: [1, -2, 3],
        idx: 0,
        wrapped: false
      });

      it.max = 3;
      assert.deepEqual(it.toJSON(), {
        arr: [1, -2, 3],
        idx: 0,
        wrapped: false,
        max: 3
      });
    });
    test('fromJSON', function() {
      var data = {
        arr: [1, -2, 3],
        idx: 0,
        wrapped: false,
        max: 3
      }
      var it = ByComponentIterator.fromJSON(data);
      assert.deepEqual(it.toJSON(), data);
      assert.deepEqual(it.arr, [1, -2, 3]);
      assert.equal(it.idx, 0);
      assert.isFalse(it.wrapped);
      assert.equal(it.max, 3);
    });
  });

  var testRRULE = testSupport.testHelper(function(runner, ruleString, options) {
    runner.test(options.description || ruleString, function() {
      if (!options.dtStart) {
        options.dtStart = options.dates[0];
      }

      var start = ICAL.Time.fromString(options.dtStart);
      if (options.dtStartZone) {
        start.zone = ICAL.TimezoneService.get(options.dtStartZone);
      }
      var iterator = recur.iterator(start);

      var inc = 0;
      var dates = [];
      var next, max;

      if ('max' in options) {
        max = options.max;
      } else if (recur.isFinite()) {
        max = options.dates.length + 1;
      } else {
        max = options.dates.length;
      }

      assert.equal(recur.isFinite(), options.byCount || options.until || false);
      assert.equal(recur.isByCount(), options.byCount || false);

      var next;
      if (options.rangeStart) {
        var rangeStart = ICAL.Time.fromString(options.rangeStart);
        next = iterator.fastForward(rangeStart);
      } else {
        next = iterator.next();
      }

      if (next) {
        dates.push(next.toString());
      }

      if (options.dtStartZone) {
        assert.equal(next.zone.tzid, start.zone.tzid);
      }

      while (++inc < max) {
        next = iterator.next();
        if (next) {
          dates.push(next.toString());
          if (options.dtStartZone) {
            assert.equal(next.zone.tzid, start.zone.tzid);
          }
        }
      }

      if (!options.rangeStart) {
        assert.equal(iterator.occurrence_number, dates.length);
      }

      assert.deepEqual(dates, options.dates || []);
    });

    var recur = ICAL.Recur.fromString(ruleString);
    if (recur.until) {
      recur.until.isDate = options.isDate;
    }

    if (["SECONDLY", "MINUTELY", "HOURLY"].indexOf(recur.freq) > -1 ||
        recur.parts.BYHOUR || recur.parts.BYMINUTE || recur.parts.BYSECOND) {
      options.noDate = true;
    }

    if (!options.noDate) {
      function convertToDate(d) {
        return d.replace(/T.*$/, '');
      }

      var dateOptions = ICAL.helpers.clone(options);
      dateOptions.noDate = true;
      dateOptions.isDate = true;
      dateOptions.dtStart = options.dtStart && convertToDate(options.dtStart)
      dateOptions.dates = options.dates.map(convertToDate);
      dateOptions.description = (options.description || ruleString) + ' (with DATE)';
      testRRULE._inner(runner, ruleString, dateOptions);
    }
  });

  // TODO convert all tests to use options object
  var testFastForward = testSupport.testHelper(function(runner, ruleString, rangeStart, next) {
    var options = rangeStart;
    if (typeof rangeStart === 'string') {
      options = {
        rangeStart: rangeStart,
        dates: [ next ]
      };
    }

    if (!options.description) {
      options.description = ruleString + " " + options.rangeStart + " -> " + options.dates[0];
    }
    if (!options.dtStart) {
      var dt = '2015-08-15', tm = 'T12:00:00';
      options.dtStart = (options.dates[0] || rangeStart).length == 10 ? dt : dt + tm;
    }
    testRRULE._inner(runner, ruleString, options);
  });

  var testFastForwardCount = testSupport.testHelper(function(runner, ruleString, next, count) {
    var ruleCountIncluding = ruleString + ';COUNT=' + count;

    testFastForward._inner(runner, ruleCountIncluding, {
      description: ruleCountIncluding + ' (with one occurrence)',
      rangeStart: next,
      byCount: true,
      dates: [ next ]
    });

    var ruleCountWithout = ruleString + ';COUNT=' + (count - 1);

    testFastForward._inner(runner, ruleCountWithout, {
      description: ruleCountWithout + ' (no occurrences)',
      rangeStart: next,
      byCount: true,
      dates: []
    });
  });

  suite("#recurrence rules", function() {
    suite("failures", function() {
      test('H/M/SECONDLY with DATE', function() {
        var start = ICAL.Time.fromString('2012-02-01');
        assert.throws(function() {
          ICAL.Recur.fromString("FREQ=SECONDLY").iterator(start);
        }, "Cannot expand SECONDLY without a date-time");
        assert.throws(function() {
          ICAL.Recur.fromString("FREQ=MINUTELY").iterator(start);
        }, "Cannot expand MINUTELY without a date-time");
        assert.throws(function() {
          ICAL.Recur.fromString("FREQ=HOURLY").iterator(start);
        }, "Cannot expand HOURLY without a date-time");
      });
    });
    suite('SECONDLY/MINUTELY', function() {
      // Simple secondly
      testRRULE('FREQ=SECONDLY;INTERVAL=3;COUNT=3', {
        byCount: true,
        dates: [
          '2015-04-30T08:00:00',
          '2015-04-30T08:00:03',
          '2015-04-30T08:00:06'
        ]
      });
      testRRULE('FREQ=SECONDLY;BYSECOND=2;BYMINUTE=2;BYHOUR=2;BYMONTHDAY=2;BYMONTH=2', {
        dates: [
          '1970-02-02T02:02:02',
          '1971-02-02T02:02:02'
        ]
      });

      // Simple minutely
      testRRULE('FREQ=MINUTELY;INTERVAL=3;COUNT=3', {
        byCount: true,
        dates: [
          '2015-04-30T08:00:00',
          '2015-04-30T08:03:00',
          '2015-04-30T08:06:00'
        ]
      });
    });

    suite('HOURLY', function() {
      suite('no extra parts', function() {
        testRRULE('FREQ=HOURLY;INTERVAL=3;COUNT=3', {
          byCount: true,
          dates: [
            '2015-04-30T08:00:00',
            '2015-04-30T11:00:00',
            '2015-04-30T14:00:00'
          ]
        });
      });

      suite('BYHOUR', function() {
        testRRULE('FREQ=HOURLY;BYHOUR=8,12,15', {
          dates: [
            '2015-04-30T08:00:00',
            '2015-04-30T12:00:00',
            '2015-04-30T15:00:00'
          ]
        });
      });

      suite('BYYEARDAY', function() {
        testRRULE('FREQ=HOURLY;BYYEARDAY=200', {
          dates: [
            '2015-07-19T22:00:00',
            '2015-07-19T23:00:00',
            '2016-07-18T00:00:00',
            '2016-07-18T01:00:00'
          ]
        });

        testRRULE('FREQ=HOURLY;INTERVAL=12;BYYEARDAY=-366', {
          dates: [
            '2016-01-01T10:00:00',
            '2016-01-01T22:00:00',
            '2020-01-01T10:00:00',
            '2020-01-01T22:00:00'
          ]
        });

        testRRULE('FREQ=HOURLY;INTERVAL=12;BYYEARDAY=366', {
          dates: [
            '2016-12-31T10:00:00',
            '2016-12-31T22:00:00',
            '2020-12-31T10:00:00',
            '2020-12-31T22:00:00'
          ]
        });

        testRRULE('FREQ=HOURLY;INTERVAL=12;BYYEARDAY=104,105,200', {
          dates: [
            '2015-07-19T12:00:00',
            '2016-04-13T00:00:00',
            '2016-04-13T12:00:00',
            '2016-04-14T00:00:00',
            '2016-04-14T12:00:00'
          ]
        });

        testRRULE('FREQ=HOURLY;INTERVAL=24;BYYEARDAY=104,-263', {
          dates: [
            '2016-04-13T00:00:00',
            '2017-04-13T00:00:00',
            '2017-04-14T00:00:00',
          ]
        });

        testRRULE('FREQ=HOURLY;INTERVAL=24;BYYEARDAY=-100,-150,-200', {
          dates: [
            '2015-08-04T12:00:00',
            '2015-09-23T12:00:00',
            '2016-06-15T12:00:00',
            '2016-08-04T12:00:00'
          ]
        });
      });

      suite('BYYEARDAY+BYMONTH', function() {
        testRRULE('FREQ=HOURLY;INTERVAL=12;BYYEARDAY=200,300;BYMONTH=10', {
          dates: [
            '2015-10-27T10:00:00',
            '2015-10-27T22:00:00',
            '2016-10-26T10:00:00',
            '2016-10-26T22:00:00'
          ]
        });
        testRRULE('FREQ=HOURLY;INTERVAL=12;BYYEARDAY=104,105,200;BYMONTH=4', {
          dates: [
            '2016-04-13T00:00:00',
            '2016-04-13T12:00:00',
            '2016-04-14T00:00:00',
            '2016-04-14T12:00:00',
            '2017-04-14T00:00:00'
          ]
        });
      });

      suite('BYYEARDAY+BYMONTHDAY', function() {
        testRRULE('FREQ=HOURLY;INTERVAL=12;BYYEARDAY=300;BYMONTHDAY=26', {
          dates: [
            '2016-10-26T10:00:00',
            '2016-10-26T22:00:00',
            '2020-10-26T10:00:00',
            '2020-10-26T22:00:00'
          ]
        });
      });

      suite('BYYEARDAY+BYMONTH+BYMONTHDAY', function() {
        testRRULE('FREQ=HOURLY;INTERVAL=12;BYYEARDAY=104,105,200;BYMONTH=4;BYMONTHDAY=14', {
          dates: [
            '2016-04-14T00:00:00',
            '2016-04-14T12:00:00',
            '2017-04-14T00:00:00',
            '2017-04-14T12:00:00'
          ]
        });
      });

      suite('BYYEARDAY+BYDAY', function() {
        testRRULE('FREQ=HOURLY;INTERVAL=12;BYYEARDAY=200,300;BYDAY=FR', {
          dates: [
            '2017-10-27T10:00:00',
            '2017-10-27T22:00:00',
            '2019-07-19T10:00:00',
            '2019-07-19T22:00:00',
          ]
        });

      });
    });

    suite('DAILY', function() {
      //daily for 10 occurrences'
      testRRULE('FREQ=DAILY;COUNT=10', {
        byCount: true,
        dates: [
          '2012-09-01T09:00:00',
          '2012-09-02T09:00:00',
          '2012-09-03T09:00:00',
          '2012-09-04T09:00:00',
          '2012-09-05T09:00:00',
          '2012-09-06T09:00:00',
          '2012-09-07T09:00:00',
          '2012-09-08T09:00:00',
          '2012-09-09T09:00:00',
          '2012-09-10T09:00:00'
        ]
      });

      //every other day - forever
      testRRULE('FREQ=DAILY;INTERVAL=2', {
        dates: [
          '2012-09-01T09:00:00',
          '2012-09-03T09:00:00',
          '2012-09-05T09:00:00',
          '2012-09-07T09:00:00',
          '2012-09-09T09:00:00',
          '2012-09-11T09:00:00',
          '2012-09-13T09:00:00',
          '2012-09-15T09:00:00',
          '2012-09-17T09:00:00',
          '2012-09-19T09:00:00'
        ]
      });

      // every 10 days, 5 occurrences
      testRRULE('FREQ=DAILY;INTERVAL=10;COUNT=5', {
        byCount: true,
        dates: [
          '2012-09-01T09:00:00',
          '2012-09-11T09:00:00',
          '2012-09-21T09:00:00',
          '2012-10-01T09:00:00',
          '2012-10-11T09:00:00'
        ]
      });

      //daily on weekdays',
      testRRULE('FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR', {
        dates: [
          '2012-01-02T09:00:00',
          '2012-01-03T09:00:00',
          '2012-01-04T09:00:00',
          '2012-01-05T09:00:00',
          '2012-01-06T09:00:00',
          '2012-01-09T09:00:00',
          '2012-01-10T09:00:00',
          '2012-01-11T09:00:00',
          '2012-01-12T09:00:00',
          '2012-01-13T09:00:00'
        ]
      });
    });

    suite('WEEKLY', function() {
      suite('no extra parts + misc.', function() {
        testRRULE('FREQ=WEEKLY', {
          dates: [
            '2014-01-01T09:00:00',
            '2014-01-08T09:00:00',
            '2014-01-15T09:00:00',
            '2014-01-22T09:00:00',
            '2014-01-29T09:00:00',
            '2014-02-05T09:00:00',
          ]
        });
                // weekly until
        testRRULE('FREQ=WEEKLY;UNTIL=2012-04-24T06:59:59Z;BYDAY=TU', {
          noDate: true,
          until: true,
          dates: [
            '2012-04-10T09:00:00',
            '2012-04-17T09:00:00'
          ]
        });
        //weekly for 10 occurrences
        testRRULE('FREQ=WEEKLY;COUNT=10', {
          byCount: true,
          dates: [
            '2012-01-05T09:00:00',
            '2012-01-12T09:00:00',
            '2012-01-19T09:00:00',
            '2012-01-26T09:00:00',
            '2012-02-02T09:00:00',
            '2012-02-09T09:00:00',
            '2012-02-16T09:00:00',
            '2012-02-23T09:00:00',
            '2012-03-01T09:00:00',
            '2012-03-08T09:00:00'
          ]
        });

        //Weekly until December 24, 2012'
        testRRULE('FREQ=WEEKLY;UNTIL=2012-12-24T00:00:00Z', {
          until: true,
          dates: [
            '2012-11-15T00:00:00',
            '2012-11-22T00:00:00',
            '2012-11-29T00:00:00',
            '2012-12-06T00:00:00',
            '2012-12-13T00:00:00',
            '2012-12-20T00:00:00'
          ]
        });

        //every other week forever'
        testRRULE('FREQ=WEEKLY;INTERVAL=2;WKST=SU', {
          dates: [
            '2012-01-15T09:00:00',
            '2012-01-29T09:00:00',
            '2012-02-12T09:00:00'
          ]
        });

        //weekly on tuesday and thursday for five weeks
        testRRULE('FREQ=WEEKLY;COUNT=4;WKST=SU;BYDAY=TU,TH', {
          dtStart: '2012-01-01T09:00:00',
          byCount: true,
          dates: [
            '2012-01-03T09:00:00',
            '2012-01-05T09:00:00',
            '2012-01-10T09:00:00',
            '2012-01-12T09:00:00'
          ]
        });

        //every other week on mo,we,fi until dec 24th 1997
        testRRULE('FREQ=WEEKLY;INTERVAL=2;UNTIL=1997-12-24T09:00:00Z;WKST=SU;BYDAY=MO,WE,FR', {
          until: true,
          dates: [
            '1997-09-01T09:00:00', '1997-09-03T09:00:00', '1997-09-05T09:00:00',
            '1997-09-15T09:00:00', '1997-09-17T09:00:00', '1997-09-19T09:00:00',
            '1997-09-29T09:00:00', '1997-10-01T09:00:00', '1997-10-03T09:00:00',
            '1997-10-13T09:00:00', '1997-10-15T09:00:00', '1997-10-17T09:00:00',
            '1997-10-27T09:00:00', '1997-10-29T09:00:00', '1997-10-31T09:00:00',
            '1997-11-10T09:00:00', '1997-11-12T09:00:00', '1997-11-14T09:00:00',
            '1997-11-24T09:00:00', '1997-11-26T09:00:00', '1997-11-28T09:00:00',
            '1997-12-08T09:00:00', '1997-12-10T09:00:00', '1997-12-12T09:00:00',
            '1997-12-22T09:00:00', '1997-12-24T09:00:00'
          ]
        });

        //weekly WKST changes output'
        //MO
        testRRULE('FREQ=WEEKLY;INTERVAL=2;COUNT=4;BYDAY=TU,SU;WKST=MO', {
          byCount: true,
          dates: [
            '1997-08-05T09:00:00',
            '1997-08-10T09:00:00',
            '1997-08-19T09:00:00',
            '1997-08-24T09:00:00'
          ]
        });

        //'weekly WKST changes output'
        //SU
        testRRULE('FREQ=WEEKLY;INTERVAL=2;COUNT=4;BYDAY=TU,SU;WKST=SU', {
          byCount: true,
          dates: [
            '1997-08-05T09:00:00',
            '1997-08-17T09:00:00',
            '1997-08-19T09:00:00',
            '1997-08-31T09:00:00'
          ]
        });
      });

      suite('BYMONTH', function() {
        testRRULE('FREQ=WEEKLY;BYMONTH=12', {
          dates: [
            '2015-12-05T09:00:00',
            '2015-12-12T09:00:00',
          ]
        });
        testRRULE('FREQ=WEEKLY;BYMONTH=1,6,8,12', {
          dates: [
            '2015-08-15T09:00:00',
            '2015-08-22T09:00:00',
            '2015-08-29T09:00:00',
            '2015-12-05T09:00:00',
            '2015-12-12T09:00:00',
            '2015-12-19T09:00:00',
            '2015-12-26T09:00:00',
            '2016-01-02T09:00:00',
          ]
        });
      });
      suite('BYDAY', function() {
        // weekly on tuesday
        testRRULE('FREQ=WEEKLY;BYDAY=TU', {
          dates: [
            '2012-09-11T09:00:00',
            '2012-09-18T09:00:00',
            '2012-09-25T09:00:00',
            '2012-10-02T09:00:00',
            '2012-10-09T09:00:00'
          ]
        });
        //buisness days for 31 occurances'
        testRRULE('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', {
          dates: [
            '2012-01-02T09:00:00', '2012-01-03T09:00:00', '2012-01-04T09:00:00', '2012-01-05T09:00:00', '2012-01-06T09:00:00',
            '2012-01-09T09:00:00', '2012-01-10T09:00:00', '2012-01-11T09:00:00', '2012-01-12T09:00:00', '2012-01-13T09:00:00',
            '2012-01-16T09:00:00', '2012-01-17T09:00:00', '2012-01-18T09:00:00', '2012-01-19T09:00:00', '2012-01-20T09:00:00',
            '2012-01-23T09:00:00', '2012-01-24T09:00:00', '2012-01-25T09:00:00', '2012-01-26T09:00:00', '2012-01-27T09:00:00',
            '2012-01-30T09:00:00', '2012-01-31T09:00:00', '2012-02-01T09:00:00', '2012-02-02T09:00:00', '2012-02-03T09:00:00',
            '2012-02-06T09:00:00', '2012-02-07T09:00:00', '2012-02-08T09:00:00', '2012-02-09T09:00:00', '2012-02-10T09:00:00',
            '2012-02-13T09:00:00'
          ]
        });
      });
      suite('BYHOUR, BYMINUTE, BYSECOND', function() {
        testRRULE('FREQ=WEEKLY;BYHOUR=9,12', {
          dates: [
            '2015-08-15T09:00:00',
            '2015-08-15T12:00:00',
            '2015-08-22T09:00:00',
            '2015-08-22T12:00:00',
          ]
        });
        testRRULE('FREQ=WEEKLY;BYMINUTE=0,9,12', {
          dates: [
            '2015-08-15T09:00:00',
            '2015-08-15T09:09:00',
            '2015-08-15T09:12:00',
            '2015-08-22T09:00:00',
          ]
        });
        testRRULE('FREQ=WEEKLY;BYSECOND=0,9,12', {
          dates: [
            '2015-08-15T09:00:00',
            '2015-08-15T09:00:09',
            '2015-08-15T09:00:12',
            '2015-08-22T09:00:00',
          ]
        });
        testRRULE('FREQ=WEEKLY;BYHOUR=12,13;BYMINUTE=0;BYSECOND=10,45', {
          dates: [
            '2015-08-15T12:00:10',
            '2015-08-15T12:00:45',
            '2015-08-15T13:00:10',
            '2015-08-15T13:00:45',
            '2015-08-22T12:00:10',
          ]
        });
      });
      suite('BYMONTH + BYDAY', function() {
        testRRULE('FREQ=WEEKLY;BYMONTH=8,10;BYDAY=MO,SA', {
          dates: [
            '2015-08-15T09:00:00',
            '2015-08-17T09:00:00',
            '2015-08-22T09:00:00',
            '2015-08-24T09:00:00',
            '2015-08-29T09:00:00',
            '2015-08-31T09:00:00',
            '2015-10-03T09:00:00',
            '2015-10-05T09:00:00',
            '2015-10-10T09:00:00',
          ]
        });
        testRRULE('FREQ=WEEKLY;BYMONTH=1,12;BYDAY=SA', {
          dates: [
            '2015-12-26T09:00:00',
            '2016-01-02T09:00:00',
          ]
        });
      });
    });

    suite('MONTHLY', function() {
      suite('no extra parts', function() {
        testRRULE('FREQ=MONTHLY', {
          dates: [
            '2013-04-03T08:00:00',
            '2013-05-03T08:00:00',
            '2013-06-03T08:00:00',
            '2013-07-03T08:00:00',
            '2013-08-03T08:00:00',
            '2013-09-03T08:00:00'
          ]
        });
        testRRULE('FREQ=MONTHLY', {
          dates: [
            '2013-01-31T08:00:00',
            '2013-03-31T08:00:00',
            '2013-05-31T08:00:00',
            '2013-07-31T08:00:00',
            '2013-08-31T08:00:00',
            '2013-10-31T08:00:00'
          ]
        });
      });

      suite('BYDAY', function() {
        testRRULE('FREQ=MONTHLY;COUNT=10;BYDAY=1FR', {
          dtStart: '2012-01-07T00:00:00',
          byCount: true,
          dates: [
            '2012-02-03T00:00:00',
            '2012-03-02T00:00:00',
            '2012-04-06T00:00:00',
            '2012-05-04T00:00:00',
            '2012-06-01T00:00:00',
            '2012-07-06T00:00:00',
            '2012-08-03T00:00:00',
            '2012-09-07T00:00:00',
            '2012-10-05T00:00:00',
            '2012-11-02T00:00:00'
          ]
        });
        testRRULE('FREQ=MONTHLY;INTERVAL=2;COUNT=4;BYDAY=1SU,-1SU', {
          dtStart: '2012-11-01T09:00:00',
          byCount: true,
          dates: [
            '2012-11-04T09:00:00',
            '2012-11-25T09:00:00',
            '2013-01-06T09:00:00',
            '2013-01-27T09:00:00'
          ]
        });
        testRRULE('FREQ=MONTHLY;BYDAY=3MO,WE,FR', {
          dates: [
            '2015-01-02T08:00:00',
            '2015-01-07T08:00:00',
            '2015-01-09T08:00:00',
            '2015-01-14T08:00:00',
            '2015-01-16T08:00:00',
            '2015-01-19T08:00:00',
            '2015-01-21T08:00:00',
            '2015-01-23T08:00:00'
          ]
        });

        testRRULE('FREQ=MONTHLY;BYDAY=5SA', {
          dtStart: '2015-02-04T08:00:00',
          dates: [
            '2015-05-30T08:00:00',
            '2015-08-29T08:00:00',
            '2015-10-31T08:00:00',
            '2016-01-30T08:00:00',
            '2016-04-30T08:00:00',
            '2016-07-30T08:00:00'
         ]
       });

        testRRULE('FREQ=MONTHLY;INTERVAL=2;BYDAY=5WE', {
          dtStart: '2015-01-01T08:00:00',
          dates: [
            '2015-07-29T08:00:00',
            '2015-09-30T08:00:00',
            '2016-03-30T08:00:00',
            '2016-11-30T08:00:00',
            '2017-03-29T08:00:00',
            '2017-05-31T08:00:00'
          ]
        });

        testRRULE('FREQ=MONTHLY;BYDAY=2MO,-5WE,5SA', {
          dates: [
            '2015-04-01T08:00:00',
            '2015-04-13T08:00:00',
            '2015-05-11T08:00:00',
            '2015-05-30T08:00:00',
            '2015-06-08T08:00:00',
            '2015-07-01T08:00:00',
            '2015-07-13T08:00:00'
          ]
        });

        testRRULE('FREQ=MONTHLY;BYDAY=1MO,-5TU,1TH,-4WE,2FR', {
          dates: [
            '2015-06-01T08:00:00',
            '2015-06-02T08:00:00',
            '2015-06-03T08:00:00',
            '2015-06-04T08:00:00',
            '2015-06-12T08:00:00',
            '2015-07-02T08:00:00',
            '2015-07-06T08:00:00',
            '2015-07-08T08:00:00',
            '2015-07-10T08:00:00'
          ]
        });
      });

      suite('BYMONTH', function() {
        testRRULE('FREQ=MONTHLY;BYMONTH=1,3,6,9,12', {
          dates: [
            '2015-01-01T08:00:00',
            '2015-03-01T08:00:00',
            '2015-06-01T08:00:00',
            '2015-09-01T08:00:00',
            '2015-12-01T08:00:00'
          ]
        });
      });

      suite('BYDAY+BYMONTHDAY', function() {
        testRRULE('FREQ=MONTHLY;BYDAY=TH;BYMONTHDAY=31', {
          dtStart: '2012-01-31T09:00:00',
          dates: [
            '2012-05-31T09:00:00',
            '2013-01-31T09:00:00',
            '2013-10-31T09:00:00'
          ]
        });
        testRRULE('FREQ=MONTHLY;BYMONTHDAY=-1;BYDAY=MO', {
          dtStart: '2012-01-01T09:00:00',
          dates: [
            '2012-04-30T09:00:00',
            '2012-12-31T09:00:00'
          ]
        });
        testRRULE('FREQ=MONTHLY;BYDAY=FR;BYMONTHDAY=13', {
          dtStart: '2012-04-01T09:00:00',
          dates: [
            '2012-04-13T09:00:00',
            '2012-07-13T09:00:00',
            '2013-09-13T09:00:00'
          ]
        });
        testRRULE('FREQ=MONTHLY;BYDAY=WE,SA;BYMONTHDAY=6,20,31', {
          dtStart: '2013-07-01T08:00:00',
          dates: [
            '2013-07-06T08:00:00',
            '2013-07-20T08:00:00',
            '2013-07-31T08:00:00',
            '2013-08-31T08:00:00',
            '2013-11-06T08:00:00',
            '2013-11-20T08:00:00'
          ]
        });
      });

      suite('BYMONTHDAY', function() {
        testRRULE('FREQ=MONTHLY;BYMONTHDAY=-3', {
          dtStart: '2012-01-01T09:00:00',
          dates: [
            '2012-01-29T09:00:00',
            '2012-02-27T09:00:00',
            '2012-03-29T09:00:00'
          ]
        });
        testRRULE('FREQ=MONTHLY;BYMONTHDAY=11,31', {
          dtStart: '2013-04-01T08:00:00',
          dates: [
            '2013-04-11T08:00:00',
            '2013-05-11T08:00:00',
            '2013-05-31T08:00:00',
            '2013-06-11T08:00:00',
            '2013-07-11T08:00:00',
            '2013-07-31T08:00:00'
          ]
        });
        testRRULE('FREQ=MONTHLY;BYMONTHDAY=1', {
          dates: [
            '2015-01-01T08:00:00',
            '2015-02-01T08:00:00',
            '2015-03-01T08:00:00'
          ]
        });

        testRRULE('FREQ=MONTHLY;BYMONTHDAY=-1', {
          dtStart: '2015-01-01T08:00:00',
          dates: [
            '2015-01-31T08:00:00',
            '2015-02-28T08:00:00',
            '2015-03-31T08:00:00'
          ]
        });

        testRRULE('FREQ=MONTHLY;BYMONTHDAY=-31,-29,1,3', {
          dates: [
            '2015-06-01T08:00:00', // -30 and 1 June
            '2015-06-02T08:00:00', // -29 and 2
            '2015-06-03T08:00:00', // -28 and 3
            '2015-07-01T08:00:00', // -31 and 1 July
            '2015-07-03T08:00:00', // -29 and 3
            '2015-08-01T08:00:00', // -31 and 1 August
          ]
        });
      });

      suite('BYDAY+BYSETPOS', function() {
        testRRULE('FREQ=MONTHLY;COUNT=3;BYDAY=TU,WE,TH;BYSETPOS=3', {
          byCount: true,
          dates: [
            '1997-09-04T09:00:00',
            '1997-10-07T09:00:00',
            '1997-11-06T09:00:00'
          ]
        });

        testRRULE('FREQ=MONTHLY;BYDAY=TH;BYSETPOS=1,5', {
          dates: [
            '2015-06-04T09:00:00',
            '2015-07-02T09:00:00',
            '2015-07-30T09:00:00',
            '2015-08-06T09:00:00'
          ]
        });
        testRRULE('FREQ=MONTHLY;BYDAY=TH;BYSETPOS=5', {
          dates: [
            '2015-04-30T09:00:00',
            '2015-07-30T09:00:00'
          ]
        });
      });

      suite('BYYEARDAY+BYDAY', function() {
        testRRULE('FREQ=YEARLY;BYYEARDAY=152,153,155,163,-183,-177,-175;BYDAY=1MO,-5TU,1TH,-4WE,2FR;BYMONTH=6,7', {
          dates: [
            '2015-06-01T08:00:00',
            '2015-06-02T08:00:00',
            '2015-06-04T08:00:00',
            '2015-06-12T08:00:00',
            '2015-07-02T08:00:00',
            '2015-07-08T08:00:00',
            '2015-07-10T08:00:00'
          ]
        });
      });

      suite('BYDAY+BYSETPOS', function() {
        testRRULE('FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1', {
          dates: [
            '2015-06-30T08:00:00',
            '2015-07-31T08:00:00',
            '2015-08-31T08:00:00',
            '2015-09-30T08:00:00',
            '2015-10-30T08:00:00',
            '2015-11-30T08:00:00'
          ]
        });
      });
    });

    suite('YEARLY', function() {
      suite('no extra parts', function() {
        testRRULE('FREQ=YEARLY;', {
          dates: [
            '2012-02-01T12:00:00',
            '2013-02-01T12:00:00',
            '2014-02-01T12:00:00'
          ]
        });
      });

      suite('BYMONTH', function() {
        testRRULE('FREQ=YEARLY;BYMONTH=3,8,10', {
          dates: [
            '2015-08-05T12:00:00',
            '2015-10-05T12:00:00',
            '2016-03-05T12:00:00',
            '2016-08-05T12:00:00',
          ]
        });
        testRRULE('FREQ=YEARLY;BYMONTH=3,8,10;INTERVAL=2', {
          dates: [
            '2015-08-05T12:00:00',
            '2015-10-05T12:00:00',
            '2017-03-05T12:00:00',
            '2017-08-05T12:00:00',
          ]
        });
      });
      suite('BYMONTHDAY', function() {
        testRRULE('FREQ=YEARLY;BYMONTHDAY=15,20', {
          dates: [
            '2015-08-15T12:00:00',
            '2015-08-20T12:00:00',
            '2016-08-15T12:00:00',
            '2016-08-20T12:00:00'
          ]
        });
        //Every year the last day of April (rule without BYMONTH)
        testRRULE('FREQ=YEARLY;BYMONTHDAY=-1', {
          dates: [
            '2014-04-30T08:00:00',
            '2015-04-30T08:00:00',
            '2016-04-30T08:00:00',
            '2017-04-30T08:00:00',
            '2018-04-30T08:00:00',
            '2019-04-30T08:00:00'
          ]
        });
      });
      suite('BYDAY', function() {
        suite('without prefix', function() {
          testRRULE('FREQ=YEARLY;BYDAY=MO', {
            dates: [
              '2015-06-15T08:00:00',
              '2015-06-22T08:00:00',
              '2015-06-29T08:00:00',
              '2015-07-06T08:00:00',
            ]
          });
          testRRULE('FREQ=YEARLY;BYDAY=MO,SU', {
            dates: [
              '2015-06-15T08:00:00',
              '2015-06-21T08:00:00',
              '2015-06-22T08:00:00',
              '2015-06-28T08:00:00',
              '2015-06-29T08:00:00',
              '2015-07-05T08:00:00',
            ]
          });
        });
        suite('positive prefix', function() {
          testRRULE('FREQ=YEARLY;BYDAY=1MO', {
            dates: [
              '2015-01-05T08:00:00',
              '2016-01-04T08:00:00',
              '2017-01-02T08:00:00',
              '2018-01-01T08:00:00',
            ]
          });
          testRRULE('FREQ=YEARLY;BYDAY=1SU', {
            dates: [
              '2015-01-04T08:00:00',
              '2016-01-03T08:00:00',
              '2017-01-01T08:00:00',
              '2018-01-07T08:00:00',
            ]
          });
          testRRULE('FREQ=YEARLY;BYDAY=2MO', {
            dates: [
              '2015-01-12T08:00:00',
              '2016-01-11T08:00:00',
              '2017-01-09T08:00:00',
              '2018-01-08T08:00:00',
            ]
          });
          testRRULE('FREQ=YEARLY;BYDAY=7MO', {
            dates: [
              '2015-02-16T08:00:00',
              '2016-02-15T08:00:00',
              '2017-02-13T08:00:00',
              '2018-02-12T08:00:00',
            ]
          });
          testRRULE('FREQ=YEARLY;BYDAY=52MO', {
            dates: [
              '2015-12-28T08:00:00',
              '2016-12-26T08:00:00',
              '2017-12-25T08:00:00',
              '2018-12-24T08:00:00',
            ]
          });
          testRRULE('FREQ=YEARLY;BYDAY=52SU', {
            dates: [
              '2014-12-28T08:00:00',
              '2015-12-27T08:00:00',
              '2016-12-25T08:00:00',
              '2017-12-24T08:00:00',
              '2018-12-30T08:00:00',
            ]
          });
          testRRULE('FREQ=YEARLY;BYDAY=53MO', {
            dates: [
              '2018-12-31T08:00:00',
              '2024-12-30T08:00:00',
            ]
          });
          testRRULE('FREQ=YEARLY;BYDAY=2MO,3SU', {
            dates: [
              '2015-01-12T08:00:00',
              '2015-01-18T08:00:00',
              '2016-01-11T08:00:00',
              '2016-01-17T08:00:00',
              '2017-01-09T08:00:00',
            ]
          });
        });
        suite('negative prefix', function() {
          testRRULE('FREQ=YEARLY;BYDAY=-1MO', {
            dates: [
              '2014-12-29T08:00:00',
              '2015-12-28T08:00:00',
              '2016-12-26T08:00:00',
              '2017-12-25T08:00:00',
              '2018-12-31T08:00:00',
            ]
          });
          testRRULE('FREQ=YEARLY;BYDAY=-1SU', {
            dates: [
              '2015-12-27T08:00:00',
              '2016-12-25T08:00:00',
              '2017-12-31T08:00:00',
              '2018-12-30T08:00:00',
            ]
          });
          testRRULE('FREQ=YEARLY;BYDAY=-2MO', {
            dates: [
              '2015-12-21T08:00:00',
              '2016-12-19T08:00:00',
              '2017-12-18T08:00:00',
              '2018-12-24T08:00:00',
            ]
          });
          testRRULE('FREQ=YEARLY;BYDAY=-7MO', {
            dates: [
              '2015-11-16T08:00:00',
              '2016-11-14T08:00:00',
              '2017-11-13T08:00:00',
              '2018-11-19T08:00:00',
            ]
          });
          testRRULE('FREQ=YEARLY;BYDAY=-52MO', {
            dates: [
              '2015-01-05T08:00:00',
              '2016-01-04T08:00:00',
              '2017-01-02T08:00:00',
              '2018-01-08T08:00:00',
            ]
          });
          testRRULE('FREQ=YEARLY;BYDAY=-52SU', {
            dates: [
              '2014-01-05T08:00:00',
              '2015-01-04T08:00:00',
              '2016-01-03T08:00:00',
              '2017-01-08T08:00:00',
              '2018-01-07T08:00:00',
            ]
          });
          testRRULE('FREQ=YEARLY;BYDAY=-53MO', {
            dates: [
              '2018-01-01T08:00:00',
              '2024-01-01T08:00:00',
            ]
          });

          testRRULE('FREQ=YEARLY;BYDAY=-3SU,-2MO', {
            dates: [
              '2015-12-13T08:00:00',
              '2015-12-21T08:00:00',
              '2016-12-11T08:00:00',
              '2016-12-19T08:00:00',
              '2017-12-17T08:00:00',
            ]
          });
        });
      });
      suite('BYMONTH+BYMONTHDAY', function() {
        testRRULE('FREQ=YEARLY;BYMONTHDAY=15,20;BYMONTH=3,8,10', {
          dates: [
            '2015-08-15T12:00:00',
            '2015-08-20T12:00:00',
            '2015-10-15T12:00:00',
            '2015-10-20T12:00:00',
            '2016-03-15T12:00:00',
            '2016-03-20T12:00:00'
          ]
        });
        //Every year the last day of February (rule with BYMONTH)
        testRRULE('FREQ=YEARLY;BYMONTHDAY=-1;BYMONTH=2', {
          dates: [
            '2014-02-28T08:00:00',
            '2015-02-28T08:00:00',
            '2016-02-29T08:00:00',
            '2017-02-28T08:00:00',
            '2018-02-28T08:00:00',
            '2019-02-28T08:00:00'
          ]
        });
      });

      suite('BYDAY+BYMONTHDAY', function() {
        //yearly, byDay,byMonthday
        testRRULE('FREQ=YEARLY;BYDAY=+1MO;BYMONTHDAY=7', {
          dtStart: '2015-01-01T08:00:00',
          dates: [
            '2019-01-07T08:00:00'
          ]
        });
      });

      suite('BYMONTH+BYDAY', function() {
        //yearly & by month with one by day
        testRRULE('FREQ=YEARLY;BYMONTH=3;BYDAY=TU', {
          dtStart: '1970-03-08T02:00:00',
          dates: [
            '1970-03-10T02:00:00'
          ]
        });

        //every monday in January, for 3 years
        testRRULE('FREQ=YEARLY;UNTIL=2015-01-31T09:00:00Z;BYMONTH=1;BYDAY=MO', {
          dtStart: '2012-05-01T09:00:00',
          until: true,
          dates: [
            '2013-01-07T09:00:00',
            '2013-01-14T09:00:00',
            '2013-01-21T09:00:00',
            '2013-01-28T09:00:00',
            '2014-01-06T09:00:00',
            '2014-01-13T09:00:00',
            '2014-01-20T09:00:00',
            '2014-01-27T09:00:00',
            '2015-01-05T09:00:00',
            '2015-01-12T09:00:00',
            '2015-01-19T09:00:00',
            '2015-01-26T09:00:00'
          ]
        });

        //Yearly, every WE and FR of January and March (more BYMONTH and more BYDAY)
        testRRULE('FREQ=YEARLY;BYMONTH=1,3;BYDAY=WE,FR', {
          dates: [
            '2014-01-01T08:00:00', '2014-01-03T08:00:00',
            '2014-01-08T08:00:00', '2014-01-10T08:00:00',
            '2014-01-15T08:00:00', '2014-01-17T08:00:00',
            '2014-01-22T08:00:00', '2014-01-24T08:00:00',
            '2014-01-29T08:00:00', '2014-01-31T08:00:00',
            '2014-03-05T08:00:00', '2014-03-07T08:00:00',
            '2014-03-12T08:00:00', '2014-03-14T08:00:00',
            '2014-03-19T08:00:00', '2014-03-21T08:00:00',
            '2014-03-26T08:00:00', '2014-03-28T08:00:00'
          ]
        });
        testRRULE('FREQ=YEARLY;BYMONTH=8,10;BYDAY=SA', {
          dates: [
            '2015-08-15T08:00:00',
            '2015-08-22T08:00:00',
            '2015-08-29T08:00:00',
            '2015-10-03T08:00:00',
          ]
        });


        // Yearly, every day of January (one BYMONTH and more BYDAY
        testRRULE('FREQ=YEARLY;BYMONTH=1;BYDAY=SU,MO,TU,WE,TH,FR,SA', {
          dates: [
            '2014-01-01T08:00:00',
            '2014-01-02T08:00:00',
            '2014-01-03T08:00:00',
            '2014-01-04T08:00:00',
            '2014-01-05T08:00:00',
            '2014-01-06T08:00:00',
            '2014-01-07T08:00:00',
            '2014-01-08T08:00:00',
            '2014-01-09T08:00:00',
            '2014-01-10T08:00:00',
            '2014-01-11T08:00:00',
            '2014-01-12T08:00:00',
            '2014-01-13T08:00:00',
            '2014-01-14T08:00:00',
            '2014-01-15T08:00:00',
            '2014-01-16T08:00:00',
            '2014-01-17T08:00:00',
            '2014-01-18T08:00:00',
            '2014-01-19T08:00:00',
            '2014-01-20T08:00:00',
            '2014-01-21T08:00:00',
            '2014-01-22T08:00:00',
            '2014-01-23T08:00:00',
            '2014-01-24T08:00:00',
            '2014-01-25T08:00:00',
            '2014-01-26T08:00:00',
            '2014-01-27T08:00:00',
            '2014-01-28T08:00:00',
            '2014-01-29T08:00:00',
            '2014-01-30T08:00:00',
            '2014-01-31T08:00:00',
            '2015-01-01T08:00:00'
          ]
        });
      });
      suite('BYMONTH, BYMONTHDAY and BYDAY', function() {
        testRRULE('FREQ=YEARLY;BYMONTH=9,10;BYMONTHDAY=15,16,17,18,19;BYDAY=MO,WE,SU', {
        dtStart: '2015-09-16T08:00:00',
        dates: [
          '2015-09-16T08:00:00',
          '2015-10-18T08:00:00',
          '2015-10-19T08:00:00',
          '2016-09-18T08:00:00',
          '2016-09-19T08:00:00',
        ]
        });
      });
      suite('BYWEEKNO', function() {
        // Basic byweekno
        testRRULE('FREQ=YEARLY;BYWEEKNO=2', {
          dates: [
            '2015-01-06T08:00:00',
            '2016-01-12T08:00:00',
            '2017-01-10T08:00:00',
            '2018-01-09T08:00:00'
          ]
        });
        testRRULE('FREQ=YEARLY;BYWEEKNO=1', {
          dates: [
            '2016-01-09T08:00:00',
            '2017-01-07T08:00:00',
          ]
        });
        testRRULE('FREQ=YEARLY;BYWEEKNO=5,10', {
          dates: [
            '2016-02-06T08:00:00',
            '2016-03-12T08:00:00',
          ]
        });
        // Basic negative byweekno,
        testRRULE('FREQ=YEARLY;BYWEEKNO=-52', {
          dates: [
            '2015-01-06T08:00:00',
            '2016-01-05T08:00:00',
            '2017-01-03T08:00:00',
            '2018-01-02T08:00:00'
          ]
        });

        //yearly, byMonth, byweekNo
        testRRULE('FREQ=YEARLY;BYMONTH=6,9;BYWEEKNO=23', {
          dates: [
            '2015-06-01T08:00:00',
            '2016-06-06T08:00:00',
            '2017-06-05T08:00:00',
            '2018-06-04T08:00:00'
          ]
        });

        //yearly, byMonth, byweekNo negative
        testRRULE('FREQ=YEARLY;BYMONTH=6,9;BYWEEKNO=-28', {
          dates: [
            '2015-06-22T08:00:00',
            '2016-06-20T08:00:00',
            '2017-06-19T08:00:00',
            '2018-06-18T08:00:00'
          ]
        });

        testRRULE('FREQ=YEARLY;BYMONTHDAY=-27,-26,-25,-24,-23;BYWEEKNO=23', {
          dates: [
            '2015-06-05T08:00:00',
            '2015-06-06T08:00:00',
            '2015-06-07T08:00:00',
            '2016-06-06T08:00:00',
            '2016-06-07T08:00:00',
            '2016-06-08T08:00:00',
            '2017-06-05T08:00:00',
            '2017-06-06T08:00:00',
          ]
        });

        //yearly, byweekNo, bymonthday
        testRRULE('FREQ=YEARLY;BYMONTHDAY=4,5,6,7,8;BYWEEKNO=23', {
          dates: [
            '2016-06-06T08:00:00',
            '2016-06-07T08:00:00',
            '2016-06-08T08:00:00',
            '2017-06-05T08:00:00',
            '2017-06-06T08:00:00',
            '2017-06-07T08:00:00',
            '2017-06-08T08:00:00',
            '2018-06-04T08:00:00',
            '2018-06-05T08:00:00',
            '2018-06-06T08:00:00',
            '2018-06-07T08:00:00',
            '2018-06-08T08:00:00'
          ]
        });

        //yearly, negative byweekNo, bymonthday
        testRRULE('FREQ=YEARLY;BYMONTHDAY=4,5,6,7,8;BYWEEKNO=-31', {
          dates: [
            '2016-06-04T08:00:00',
            '2016-06-05T08:00:00',
            '2017-06-04T08:00:00',
            '2020-06-04T08:00:00',
          ]
        });

        //yearly, byweekno, byday
        testRRULE('FREQ=YEARLY;BYWEEKNO=3;BYDAY=MO,TU', {
          dates: [
            '2016-01-18T08:00:00',
            '2016-01-19T08:00:00',
            '2017-01-16T08:00:00',
            '2017-01-17T08:00:00',
          ]
        });
    });

    suite('BYYEARDAY', function() {
      // Tycho brahe days - yearly, byYearDay with negative offsets
      testRRULE('FREQ=YEARLY;BYYEARDAY=1,2,4,6,11,12,20,42,48,49,-306,-303,' +
                '-293,-292,-266,-259,-258,-239,-228,-209,-168,-164,-134,-133,' +
                '-113,-105,-87,-56,-44,-26,-21,-14', {
        dates: [
          '2015-01-01T12:00:00',
          '2015-01-02T12:00:00',
          '2015-01-04T12:00:00',
          '2015-01-06T12:00:00',
          '2015-01-11T12:00:00',
          '2015-01-12T12:00:00',
          '2015-01-20T12:00:00',
          '2015-02-11T12:00:00',
          '2015-02-17T12:00:00',
          '2015-02-18T12:00:00',
          '2015-03-01T12:00:00',
          '2015-03-04T12:00:00',
          '2015-03-14T12:00:00',
          '2015-03-15T12:00:00',
          '2015-04-10T12:00:00',
          '2015-04-17T12:00:00',
          '2015-04-18T12:00:00',
          '2015-05-07T12:00:00',
          '2015-05-18T12:00:00',
          '2015-06-06T12:00:00',
          '2015-07-17T12:00:00',
          '2015-07-21T12:00:00',
          '2015-08-20T12:00:00',
          '2015-08-21T12:00:00',
          '2015-09-10T12:00:00',
          '2015-09-18T12:00:00',
          '2015-10-06T12:00:00',
          '2015-11-06T12:00:00',
          '2015-11-18T12:00:00',
          '2015-12-06T12:00:00',
          '2015-12-11T12:00:00',
          '2015-12-18T12:00:00'
        ]
      });

      // Leap year - yearly, byYearDay with negative offsets
      testRRULE('FREQ=YEARLY;BYYEARDAY=-308,-307,-306', {
        dtStart: '2012-01-01T12:00:00',
        dates: [
          '2012-02-28T12:00:00',
          '2012-02-29T12:00:00',
          '2012-03-01T12:00:00',
        ]
      });

      // Non-leap year - yearly, byYearDay with negative offsets
      testRRULE('FREQ=YEARLY;BYYEARDAY=-307,-306,-305', {
        dtStart: '2013-01-01T12:00:00',
        dates: [
          '2013-02-28T12:00:00',
          '2013-03-01T12:00:00',
          '2013-03-02T12:00:00',
        ]
      });
    });
    });
/*
    suite("with timezones", function() {
      testSupport.useTimezones('America/New_York');

      // This one is bound to fail some time, when we skip invalid dates on DST
      // boundaries. Still keeping it here so we have at least one test that
      // checks for the zone on the returned dates.
      testRRULE('FREQ=YEARLY;BYMONTH=11;BYDAY=1SU;BYHOUR=2,5', {
        dtStartZone: 'America/New_York',
        dates: [
          '2015-11-01T05:30:00',
          '2016-11-06T02:30:00'
        ]
      });
    });*/
  });

  suite('#fastForward', function() {
    suite('failures', function() {
      test('before DTSTART', function() {
        var start = ICAL.Time.fromString('2012-02-01T09:00:00');
        var recur = ICAL.Recur.fromString("FREQ=DAILY");
        var iterator = recur.iterator(start);
        assert.throws(function() {
          var rangeStart = ICAL.Time.fromString('1990-02-01T09:00:00');
          iterator.fastForward(rangeStart);
        }, "Can't fastForward before DTSTART");
      });
    });
    suite('UNTIL', function() {
      testFastForward('FREQ=DAILY;UNTIL=2015-08-16T12:00:00', {
        description: 'rangeStart falls on UNTIL',
        rangeStart: '2015-08-16T12:00:00',
        dates: [ '2015-08-16T12:00:00' ],
        until: true,
      });
      testFastForward('FREQ=DAILY;UNTIL=2015-08-16T12:00:00', {
        description: 'rangeStart past UNTIL',
        rangeStart: '2015-08-17T12:00:00',
        dates: [],
        until: true,
      });
    });

    suite('COUNT', function() {
      testFastForwardCount('FREQ=DAILY', '2015-08-20T12:00:00', 6);
      testFastForwardCount('FREQ=DAILY;BYHOUR=12,15;BYMINUTE=0,30;BYSECOND=0,30', '2015-08-20T12:00:00', 41);
    });

    suite('SECONDLY', function() {
      suite('no extra parts', function() {
        testFastForward('FREQ=SECONDLY', {
          rangeStart: '2015-09-01T12:59:59',
          dates: [ '2015-09-01T12:59:59' ]
        });
        testFastForward('FREQ=SECONDLY;INTERVAL=5', {
          rangeStart: '2015-09-01T13:00:01',
          dates: [ '2015-09-01T13:00:05' ]
        });
      });
      suite('BYMONTH', function() {
        testFastForward('FREQ=SECONDLY;BYMONTH=3,10', {
          rangeStart: '2015-09-30T23:59:00',
          dates: [ '2015-10-01T00:00:00' ],
        });
        testFastForward('FREQ=SECONDLY;BYMONTH=8,10', {
          rangeStart: '2015-08-15T16:00:00',
          dates: [ '2015-08-15T16:00:00' ],
        });
      })
      suite('BYMONTHDAY', function() {
        testFastForward('FREQ=SECONDLY;BYMONTHDAY=5,15', {
          rangeStart: '2015-09-04T23:59:00',
          dates: [ '2015-09-05T00:00:00' ],
        });
        testFastForward('FREQ=SECONDLY;BYMONTHDAY=5,15', {
          rangeStart: '2015-08-15T16:00:00',
          dates: [ '2015-08-15T16:00:00' ],
        });
      })
      suite('BYMONTH+BYMONTHDAY', function() {
        testFastForward('FREQ=SECONDLY;BYMONTH=3,10;BYMONTHDAY=5,15', {
          rangeStart: '2015-09-04T12:00:00',
          dates: [ '2015-10-05T00:00:00' ],
        });
        testFastForward('FREQ=SECONDLY;BYMONTH=8,10;BYMONTHDAY=5,15', {
          rangeStart: '2015-08-15T16:00:00',
          dates: [ '2015-08-15T16:00:00' ],
        });
      });
      suite("BYDAY", function() {
        testFastForward('FREQ=SECONDLY;BYDAY=TU,TH', {
          rangeStart: '2015-09-07T23:59:00',
          dates: [ '2015-09-08T00:00:00' ],
        });
        testFastForward('FREQ=SECONDLY;BYDAY=SA,SU', {
          rangeStart: '2015-08-15T16:00:00',
          dates: [ '2015-08-15T16:00:00' ],
        });
      });
      suite("BYDAY+BYMONTH", function() {
        testFastForward('FREQ=SECONDLY;BYMONTH=8,10;BYDAY=TU,TH', {
          rangeStart: '2015-09-30T23:59:00',
          dates: [ '2015-10-01T00:00:00' ],
        });
        testFastForward('FREQ=SECONDLY;BYMONTH=8,10;BYDAY=SA,SU', {
          rangeStart: '2015-08-15T16:00:00',
          dates: [ '2015-08-15T16:00:00' ],
        });
      });
      suite("BYDAY+BYMONTH+BYMONTHDAY", function() {
        testFastForward('FREQ=SECONDLY;BYMONTH=8,10;BYMONTHDAY=5,15;BYDAY=TU,TH', {
          rangeStart: '2015-09-30T23:59:59',
          dates: [ '2015-10-15T00:00:00' ],
        });
        testFastForward('FREQ=SECONDLY;BYMONTH=8,10;BYMONTHDAY=5,15;BYDAY=SA,SU', {
          rangeStart: '2015-08-15T16:00:00',
          dates: [ '2015-08-15T16:00:00' ],
        });
      });
      suite("BYYEARDAY", function() {
        testFastForward('FREQ=SECONDLY;BYYEARDAY=227,229', {
          rangeStart: '2015-08-15T12:00:01',
          dates: [ '2015-08-15T12:00:01' ]
        });
        testFastForward('FREQ=SECONDLY;BYYEARDAY=227,229', {
          rangeStart: '2015-08-16T23:30:00',
          dates: [ '2015-08-17T00:00:00' ]
        });
        testFastForward('FREQ=SECONDLY;BYYEARDAY=1,364', {
          dtStart: '2015-12-30T23:59:59',
          rangeStart: '2015-12-31T23:59:59',
          dates: [ '2016-01-01T00:00:00' ]
        });
      });
      suite("BYHOUR+BYMINUTE+BYSECOND+BYDAY+BYMONTH+BYMONTHDAY", function() {
        testFastForward('FREQ=SECONDLY;BYHOUR=12,14;BYMINUTE=2,5;BYSECOND=10,20;BYMONTH=8,10;BYMONTHDAY=5,15;BYDAY=TU,TH', {
          rangeStart: '2015-09-30T23:59:59',
          dates: [ '2015-10-15T12:02:10' ],
        });
        testFastForward('FREQ=SECONDLY;BYHOUR=12,14;BYMINUTE=2,5;BYSECOND=10,20;BYMONTH=8,10;BYMONTHDAY=5,15;BYDAY=SA,SU', {
          rangeStart: '2015-08-15T12:30:00',
          dates: [ '2015-08-15T14:02:10' ],
        });
      });
      suite("BYSECOND+BYMINUTE+BYHOUR+BYMONTH+BYMONTHDAY", function() {
        testFastForward('FREQ=SECONDLY;BYSECOND=20,30;BYMINUTE=40,50;BYHOUR=2,5;BYMONTH=1,10;BYMONTHDAY=1,20', {
          rangeStart: '2015-11-21T06:55:35',
          dates: [ '2016-01-01T02:40:20' ]
        });
      });
    });

    suite('MINUTELY', function() {
      suite('no extra parts', function() {
        testFastForward('FREQ=MINUTELY', {
          rangeStart: '2015-09-01T12:59:59',
          dates: [ '2015-09-01T13:00:00' ]
        });
        testFastForward('FREQ=MINUTELY;INTERVAL=2', {
          rangeStart: '2015-09-01T13:00:01',
          dates: [ '2015-09-01T13:02:00' ]
        });
      });
      suite('BYMONTH', function() {
        testFastForward('FREQ=MINUTELY;BYMONTH=3,10', {
          rangeStart: '2015-09-04T12:00:00',
          dates: [ '2015-10-01T00:00:00' ],
        });
        testFastForward('FREQ=MINUTELY;BYMONTH=8,10', {
          rangeStart: '2015-08-15T16:00:00',
          dates: [ '2015-08-15T16:00:00' ],
        });
      })
      suite('BYMONTHDAY', function() {
        testFastForward('FREQ=MINUTELY;BYMONTHDAY=5,15', {
          rangeStart: '2015-09-04T12:00:00',
          dates: [ '2015-09-05T00:00:00' ],
        });
        testFastForward('FREQ=MINUTELY;BYMONTHDAY=5,15', {
          rangeStart: '2015-08-15T16:00:00',
          dates: [ '2015-08-15T16:00:00' ],
        });
      })
      suite('BYMONTH+BYMONTHDAY', function() {
        testFastForward('FREQ=MINUTELY;BYMONTH=3,10;BYMONTHDAY=5,15', {
          rangeStart: '2015-09-04T12:00:00',
          dates: [ '2015-10-05T00:00:00' ],
        });
        testFastForward('FREQ=MINUTELY;BYMONTH=8,10;BYMONTHDAY=5,15', {
          rangeStart: '2015-08-15T16:00:00',
          dates: [ '2015-08-15T16:00:00' ],
        });
      });
      suite("BYDAY", function() {
        testFastForward('FREQ=MINUTELY;BYDAY=TU,TH', {
          rangeStart: '2015-09-04T12:00:00',
          dates: [ '2015-09-08T00:00:00' ],
        });
        testFastForward('FREQ=MINUTELY;BYDAY=SA,SU', {
          rangeStart: '2015-08-15T16:00:00',
          dates: [ '2015-08-15T16:00:00' ],
        });
      });
      suite("BYDAY+BYMONTH", function() {
        testFastForward('FREQ=MINUTELY;BYMONTH=8,10;BYDAY=TU,TH', {
          rangeStart: '2015-09-04T12:00:00',
          dates: [ '2015-10-01T00:00:00' ],
        });
        testFastForward('FREQ=MINUTELY;BYMONTH=8,10;BYDAY=SA,SU', {
          rangeStart: '2015-08-15T16:00:00',
          dates: [ '2015-08-15T16:00:00' ],
        });
      });
      suite("BYDAY+BYMONTH+BYMONTHDAY", function() {
        testFastForward('FREQ=MINUTELY;BYMONTH=8,10;BYMONTHDAY=5,15;BYDAY=TU,TH', {
          rangeStart: '2015-09-04T12:00:00',
          dates: [ '2015-10-15T00:00:00' ],
        });
        testFastForward('FREQ=MINUTELY;BYMONTH=8,10;BYMONTHDAY=5,15;BYDAY=SA,SU', {
          rangeStart: '2015-08-15T16:00:00',
          dates: [ '2015-08-15T16:00:00' ],
        });
      });
      suite("BYYEARDAY", function() {
        testFastForward('FREQ=MINUTELY;BYYEARDAY=227,300', {
          rangeStart: '2015-08-15T12:30:20',
          dates: [ '2015-08-15T12:31:00' ]
        });
        testFastForward('FREQ=MINUTELY;BYYEARDAY=227,301', {
          rangeStart: '2015-09-04T12:30:00',
          dates: [ '2015-10-28T00:00:00' ]
        });
        testFastForward('FREQ=MINUTELY;BYYEARDAY=104,227', {
          rangeStart: '2015-09-04T12:30:00',
          dates: [ '2016-04-13T00:00:00' ]
        });
      });
      suite('BYHOUR', function() {
        testFastForward('FREQ=MINUTELY;BYHOUR=12,14', {
          rangeStart: '2015-08-15T13:59:01',
          dates: [ '2015-08-15T14:00:00' ]
        });
      });
      suite("BYHOUR+BYMINUTE+BYSECOND+BYDAY+BYMONTH+BYMONTHDAY", function() {
        testFastForward('FREQ=MINUTELY;BYHOUR=12,14;BYMINUTE=2,5;BYSECOND=10,20;BYMONTH=8,10;BYMONTHDAY=5,15;BYDAY=TU,TH', {
          rangeStart: '2015-09-04T12:00:00',
          dates: [ '2015-10-15T12:02:10' ],
        });
        testFastForward('FREQ=MINUTELY;BYHOUR=12,14;BYMINUTE=2,5;BYSECOND=10,20;BYMONTH=8,10;BYMONTHDAY=5,15;BYDAY=SA,SU', {
          rangeStart: '2015-08-15T12:30:00',
          dates: [ '2015-08-15T14:02:10' ],
        });
      });
      suite("BYSECOND+BYSETPOS", function() {
        testFastForward('FREQ=MINUTELY;BYSECOND=10,20;BYSETPOS=-1', {
          rangeStart: '2015-09-04T12:00:00',
          dates: [ '2015-09-04T12:00:20' ]
        });
        testFastForward('FREQ=MINUTELY;BYSECOND=10,20;BYSETPOS=-1', {
          rangeStart: '2015-08-15T12:30:00',
          dates: [ '2015-08-15T12:30:20' ],
        });
      });
    });

    suite('HOURLY', function() {
      suite('no extra parts', function() {
        testFastForward('FREQ=HOURLY', {
          rangeStart: '2015-09-01T12:59:59',
          dates: [ '2015-09-01T13:00:00' ]
        });
        testFastForward('FREQ=HOURLY;INTERVAL=2', {
          rangeStart: '2015-09-01T12:59:59',
          dates: [ '2015-09-01T14:00:00' ]
        });
      });
      suite('BYMONTH', function() {
        testFastForward('FREQ=HOURLY;BYMONTH=3,10', {
          rangeStart: '2015-09-04T12:00:00',
          dates: [ '2015-10-01T00:00:00' ],
        });
        testFastForward('FREQ=HOURLY;BYMONTH=8,10', {
          rangeStart: '2015-08-15T16:00:00',
          dates: [ '2015-08-15T16:00:00' ],
        });
      })
      suite('BYMONTHDAY', function() {
        testFastForward('FREQ=HOURLY;BYMONTHDAY=5,15', {
          rangeStart: '2015-09-04T12:00:00',
          dates: [ '2015-09-05T00:00:00' ],
        });
        testFastForward('FREQ=HOURLY;BYMONTHDAY=5,15', {
          rangeStart: '2015-08-15T16:00:00',
          dates: [ '2015-08-15T16:00:00' ],
        });
      })
      suite('BYMONTH+BYMONTHDAY', function() {
        testFastForward('FREQ=HOURLY;BYMONTH=3,10;BYMONTHDAY=5,15', {
          rangeStart: '2015-09-04T12:00:00',
          dates: [ '2015-10-05T00:00:00' ],
        });
        testFastForward('FREQ=HOURLY;BYMONTH=8,10;BYMONTHDAY=5,15', {
          rangeStart: '2015-08-15T16:00:00',
          dates: [ '2015-08-15T16:00:00' ],
        });
      });
      suite("BYDAY", function() {
        testFastForward('FREQ=HOURLY;BYDAY=TU,TH', {
          rangeStart: '2015-09-04T12:00:00',
          dates: [ '2015-09-08T00:00:00' ],
        });
        testFastForward('FREQ=HOURLY;BYDAY=SA,SU', {
          rangeStart: '2015-08-15T16:00:00',
          dates: [ '2015-08-15T16:00:00' ],
        });
      });
      suite("BYDAY+BYMONTH", function() {
        testFastForward('FREQ=HOURLY;BYMONTH=8,10;BYDAY=TU,TH', {
          rangeStart: '2015-09-04T12:00:00',
          dates: [ '2015-10-01T00:00:00' ],
        });
        testFastForward('FREQ=HOURLY;BYMONTH=8,10;BYDAY=SA,SU', {
          rangeStart: '2015-08-15T16:00:00',
          dates: [ '2015-08-15T16:00:00' ],
        });
      });
      suite("BYDAY+BYMONTH+BYMONTHDAY", function() {
        testFastForward('FREQ=HOURLY;BYMONTH=8,10;BYMONTHDAY=5,15;BYDAY=TU,TH', {
          rangeStart: '2015-09-04T12:00:00',
          dates: [ '2015-10-15T00:00:00' ],
        });
        testFastForward('FREQ=HOURLY;BYMONTH=8,10;BYMONTHDAY=5,15;BYDAY=SA,SU', {
          rangeStart: '2015-08-15T16:00:00',
          dates: [ '2015-08-15T16:00:00' ],
        });
      });
      suite("BYYEARDAY", function() {
        testFastForward('FREQ=HOURLY;BYYEARDAY=227,300', {
          rangeStart: '2015-08-15T12:30:00',
          dates: [ '2015-08-15T13:00:00' ]
        });
        testFastForward('FREQ=HOURLY;BYYEARDAY=227,301', {
          rangeStart: '2015-09-04T12:30:00',
          dates: [ '2015-10-28T00:00:00' ]
        });
        testFastForward('FREQ=HOURLY;BYYEARDAY=104,227', {
          rangeStart: '2015-09-04T12:30:00',
          dates: [ '2016-04-13T00:00:00' ]
        });
      });
      suite("BYHOUR+BYMINUTE+BYSECOND+BYDAY+BYMONTH+BYMONTHDAY", function() {
        testFastForward('FREQ=HOURLY;BYHOUR=12,14;BYMINUTE=2,5;BYSECOND=10,20;BYMONTH=8,10;BYMONTHDAY=5,15;BYDAY=TU,TH', {
          rangeStart: '2015-09-04T12:00:00',
          dates: [ '2015-10-15T12:02:10' ],
        });
        testFastForward('FREQ=HOURLY;BYHOUR=12,14;BYMINUTE=2,5;BYSECOND=10,20;BYMONTH=8,10;BYMONTHDAY=5,15;BYDAY=SA,SU', {
          rangeStart: '2015-08-15T12:30:00',
          dates: [ '2015-08-15T14:02:10' ],
        });
      });
      suite("BYMINUTE+BYSECOND+BYSETPOS", function() {
        testFastForward('FREQ=HOURLY;BYMINUTE=2,5;BYSECOND=10,20;BYSETPOS=-1', {
          rangeStart: '2015-09-04T12:00:00',
          dates: [ '2015-09-04T12:05:20' ]
        });
        testFastForward('FREQ=HOURLY;BYMINUTE=2,5;BYSECOND=10,20;BYSETPOS=-1', {
          rangeStart: '2015-08-15T12:30:00',
          dates: [ '2015-08-15T13:05:20' ],
        });
      });
    });

    suite('DAILY', function() {
      suite('no extra parts', function() {
        testFastForward('FREQ=DAILY',
                        '2015-09-01', '2015-09-01T12:00:00');
        testFastForward('FREQ=DAILY',
                        '2015-09-01T12:00:00', '2015-09-01T12:00:00');
        testFastForward('FREQ=DAILY', {
          rangeStart:'2015-09-01T12:00:01',
          dates: [ '2015-09-02T12:00:00' ],
          noDate: true
        });


        testFastForward('FREQ=DAILY;INTERVAL=3',
                        '2015-09-04T12:00:00', '2015-09-05T12:00:00');
        testFastForward('FREQ=DAILY;INTERVAL=5',
                        '2015-09-04T12:00:00', '2015-09-04T12:00:00');
        testFastForward('FREQ=DAILY;INTERVAL=6',
                        '2015-09-04T12:00:00', '2015-09-08T12:00:00');

        testFastForward('FREQ=DAILY;INTERVAL=10', {
          rangeStart: '2015-09-04T12:00:01',
          dates: [ '2015-09-14T12:00:00' ],
          noDate: true
        });
      });
      suite("BYMONTH", function() {
        testFastForward('FREQ=DAILY;BYMONTH=3,10',
                        '2015-09-04T12:00:00', '2015-10-01T12:00:00');
        testFastForward('FREQ=DAILY;BYMONTH=3,9',
                        '2015-09-04T12:00:00', '2015-09-04T12:00:00');
        testFastForward('FREQ=DAILY;BYMONTH=3,6',
                        '2015-09-01T12:00:00', '2016-03-01T12:00:00');

        testFastForward('FREQ=DAILY;INTERVAL=3;BYMONTH=8,10', {
          rangeStart: '2015-08-21T12:00:01',
          dates: [ '2015-08-24T12:00:00' ],
          noDate: true
        });
      });
      suite("BYMONTHDAY", function() {
        testFastForward('FREQ=DAILY;BYMONTHDAY=5,15',
                        '2015-09-04T12:00:00', '2015-09-05T12:00:00');
        testFastForward('FREQ=DAILY;BYMONTHDAY=5,15',
                        '2015-09-10T12:00:00', '2015-09-15T12:00:00');
        testFastForward('FREQ=DAILY;BYMONTHDAY=5,15',
                        '2015-09-16T12:00:00', '2015-10-05T12:00:00');

        testFastForward('FREQ=DAILY;INTERVAL=2;BYMONTHDAY=5,15',
                        '2015-09-06T12:00:00', '2015-11-05T12:00:00');
        testFastForward('FREQ=DAILY;INTERVAL=3;BYMONTHDAY=5,15',
                        '2015-09-06T12:00:00', '2015-10-05T12:00:00');
        testFastForward('FREQ=DAILY;INTERVAL=4;BYMONTHDAY=5,15',
                        '2015-09-06T12:00:00', '2015-11-15T12:00:00');
        testFastForward('FREQ=DAILY;INTERVAL=10;BYMONTHDAY=5,15',
                        '2015-09-06T12:00:00', '2017-02-05T12:00:00');
        testFastForward('FREQ=DAILY;INTERVAL=10;BYMONTHDAY=5,15',
                        '2015-09-06T12:00:00', '2017-02-05T12:00:00');

        testFastForward('FREQ=DAILY;INTERVAL=1;BYMONTHDAY=15,31',
                        '2015-09-16T12:00:00', '2015-10-15T12:00:00');
      });
      suite("BYMONTHDAY+BYMONTH", function() {
        testFastForward('FREQ=DAILY;BYMONTHDAY=15,20,25;BYMONTH=8,10',
                        '2015-08-21T12:00:00', '2015-08-25T12:00:00');
        testFastForward('FREQ=DAILY;BYMONTHDAY=15,20,25;BYMONTH=8,10',
                        '2015-08-26T12:00:00', '2015-10-15T12:00:00');
        testFastForward('FREQ=DAILY;BYMONTHDAY=15,20,25;BYMONTH=8,10',
                        '2015-12-26T12:00:00', '2016-08-15T12:00:00');

        testFastForward('FREQ=DAILY;INTERVAL=3;BYMONTHDAY=15,20,25;BYMONTH=8,10',
                        '2015-08-21T12:00:00', '2015-10-20T12:00:00');
      });
      suite("BYDAY", function() {
        testFastForward('FREQ=DAILY;BYDAY=TU,TH',
                        '2015-09-04T12:00:00', '2015-09-08T12:00:00');
        testFastForward('FREQ=DAILY;INTERVAL=10;BYDAY=TU,TH',
                        '2015-09-04T12:00:00', '2015-09-24T12:00:00');
      });
      suite("BYDAY+BYMONTH", function() {
        testFastForward('FREQ=DAILY;BYDAY=TU,TH;BYMONTH=9,12',
                        '2015-09-30T12:00:00', '2015-12-01T12:00:00');
        testFastForward('FREQ=DAILY;INTERVAL=10;BYDAY=TU,TH;BYMONTH=9,12', {
          rangeStart: '2015-09-24T12:00:01',
          dates: [ '2015-12-03T12:00:00' ],
          noDate: true
        });
      });
      suite("BYDAY+BYMONTH+BYMONTHDAY", function() {
        testFastForward('FREQ=DAILY;BYDAY=TU,TH;BYMONTH=9,12;BYMONTHDAY=8,15',
                        '2015-09-30T12:00:00', '2015-12-08T12:00:00');
        testFastForward('FREQ=DAILY;INTERVAL=10;BYDAY=TU,TH;BYMONTH=9,12;BYMONTHDAY=8,15', {
          rangeStart:'2015-09-24T12:00:01',
          dates: [ '2016-09-08T12:00:00' ],
          noDate: true
        });
      });
      suite("BYHOUR+BYMINUTE+BYSECOND+BYDAY+BYMONTH+BYMONTHDAY", function() {
        testFastForward('FREQ=DAILY;BYHOUR=12,15;BYMINUTE=0,20;BYSECOND=0,25;BYDAY=TU,TH;BYMONTH=9,12;BYMONTHDAY=8,15',
                        '2015-09-15T15:20:26', '2015-12-08T12:00:00');
        testFastForward('FREQ=DAILY;BYHOUR=12,15;BYMINUTE=0,20;BYSECOND=0,25;BYDAY=TU,TH;BYMONTH=9,12;BYMONTHDAY=8,15',
                        '2015-09-15T15:20:20', '2015-09-15T15:20:25');
        testFastForward('FREQ=DAILY;BYHOUR=12,15;BYMINUTE=0,20;BYSECOND=0,25;BYDAY=TU,TH;BYMONTH=9,12;BYMONTHDAY=8,15',
                        '2015-09-15T12:00:01', '2015-09-15T12:00:25');

        testFastForward('FREQ=DAILY;BYHOUR=12,15;BYMINUTE=0,20;BYSECOND=0,25;BYDAY=TU,TH;BYMONTH=9,12;BYMONTHDAY=8,15;INTERVAL=10',
                        '2016-09-15T12:00:00', '2026-12-15T12:00:00');
      });
      suite("BYHOUR+BYMINUTE+BYSECOND+BYSETPOS", function() {
        testFastForward('FREQ=DAILY;BYHOUR=12,15;BYMINUTE=0,20;BYSECOND=0,25;BYSETPOS=-1',
                        '2015-08-15T12:00:00', '2015-08-15T15:20:25');

        testFastForward('FREQ=DAILY;BYHOUR=12,15;BYMINUTE=0,20;BYSECOND=0,25;BYSETPOS=-1;INTERVAL=10',
                        '2015-08-15T12:00:00', '2015-08-15T15:20:25');
      });
    });

    suite('MONTHLY', function() {
      suite('no extra parts', function() {
        testFastForward('FREQ=MONTHLY',
                        '2015-09-01', '2015-09-15T12:00:00');
        testFastForward('FREQ=MONTHLY',
                        '2015-09-15T12:00:00', '2015-09-15T12:00:00');
        testFastForward('FREQ=MONTHLY', {
          rangeStart:'2015-09-15T12:00:01',
          dates: [ '2015-10-15T12:00:00' ],
          noDate: true
        });

        testFastForward('FREQ=MONTHLY;INTERVAL=3',
                        '2015-09-04T12:00:00', '2015-11-15T12:00:00');
        testFastForward('FREQ=MONTHLY;INTERVAL=12',
                        '2015-09-04T12:00:01', '2016-08-15T12:00:00');
      });
      suite("BYMONTH", function() {
        testFastForward('FREQ=MONTHLY;BYMONTH=3,8,10',
                        '2015-09-04T12:00:00', '2015-10-15T12:00:00');
        testFastForward('FREQ=MONTHLY;BYMONTH=3,8,9',
                        '2015-09-15T12:00:00', '2015-09-15T12:00:00');
        testFastForward('FREQ=MONTHLY;BYMONTH=3,8,6',
                        '2015-09-01T12:00:00', '2016-03-15T12:00:00');

        testFastForward('FREQ=MONTHLY;INTERVAL=5;BYMONTH=8,10,12',
                        '2015-08-21T12:00:01', '2018-12-15T12:00:00');
      });
      suite("BYMONTHDAY", function() {
        testFastForward('FREQ=MONTHLY;BYMONTHDAY=5,15',
                        '2015-09-04T12:00:00', '2015-09-05T12:00:00');
        testFastForward('FREQ=MONTHLY;BYMONTHDAY=5,15',
                        '2015-09-10T12:00:00', '2015-09-15T12:00:00');
        testFastForward('FREQ=MONTHLY;BYMONTHDAY=5,15',
                        '2015-09-16T12:00:00', '2015-10-05T12:00:00');

        testFastForward('FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=5,15',
                        '2015-10-06T12:00:00', '2015-10-15T12:00:00');
        testFastForward('FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=5,15',
                        '2015-09-06T12:00:00', '2015-11-05T12:00:00');
        testFastForward('FREQ=MONTHLY;INTERVAL=10;BYMONTHDAY=5,15',
                        '2015-09-06T12:00:00', '2016-06-05T12:00:00');

        testFastForward('FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=15,31',
                        '2015-09-16T12:00:00', '2015-10-15T12:00:00');
      });
      suite("BYMONTHDAY+BYMONTH", function() {
        testFastForward('FREQ=MONTHLY;BYMONTHDAY=15,20,25;BYMONTH=8,10',
                        '2015-08-21T12:00:00', '2015-08-25T12:00:00');
        testFastForward('FREQ=MONTHLY;BYMONTHDAY=15,20,25;BYMONTH=8,10',
                        '2015-08-26T12:00:00', '2015-10-15T12:00:00');
        testFastForward('FREQ=MONTHLY;BYMONTHDAY=15,20,25;BYMONTH=8,10',
                        '2015-12-26T12:00:00', '2016-08-15T12:00:00');

        testFastForward('FREQ=MONTHLY;INTERVAL=5;BYMONTHDAY=15,20,25;BYMONTH=8,10',
                        '2015-08-26T12:00:00', '2019-10-15T12:00:00');
      });
      suite("BYDAY", function() {
        testFastForward('FREQ=MONTHLY;BYDAY=TU,TH',
                        '2015-09-04T12:00:00', '2015-09-08T12:00:00');
        testFastForward('FREQ=MONTHLY;BYDAY=-1SA',
                        '2015-09-04T12:00:00', '2015-09-26T12:00:00');
        testFastForward('FREQ=MONTHLY;BYDAY=+3MO',
                        '2015-09-04T12:00:00', '2015-09-21T12:00:00');
        testFastForward('FREQ=MONTHLY;BYDAY=5TH',
                        '2015-09-04T12:00:00', '2015-10-29T12:00:00');

        testFastForward('FREQ=MONTHLY;INTERVAL=10;BYDAY=TU,TH',
                        '2015-09-04T12:00:00', '2016-06-02T12:00:00');
        testFastForward('FREQ=MONTHLY;INTERVAL=10;BYDAY=5TH',
                        '2015-09-04T12:00:00', '2016-06-30T12:00:00');
      });
      suite("BYDAY+BYMONTH", function() {
        testFastForward('FREQ=MONTHLY;BYDAY=TU,TH;BYMONTH=8,9,12',
                        '2015-09-30T12:00:00', '2015-12-01T12:00:00');
        testFastForward('FREQ=MONTHLY;BYDAY=5TU,-2TH;BYMONTH=8,9,12',
                        '2015-09-30T12:00:00', '2015-12-24T12:00:00');

        testFastForward('FREQ=MONTHLY;INTERVAL=10;BYDAY=TU,TH;BYMONTH=8,9,12',
                        '2015-09-24T12:00:01', '2018-12-04T12:00:00');
        testFastForward('FREQ=MONTHLY;INTERVAL=10;BYDAY=5TU,-2TH;BYMONTH=8,9,12',
                        '2015-09-24T12:00:01', '2018-12-20T12:00:00');
      });
      suite("BYDAY+BYMONTH+BYMONTHDAY", function() {
        testFastForward('FREQ=MONTHLY;BYDAY=TU,TH;BYMONTH=9,12;BYMONTHDAY=8,15',
                        '2015-09-30T12:00:00', '2015-12-08T12:00:00');
        testFastForward('FREQ=MONTHLY;INTERVAL=10;BYDAY=TU,TH;BYMONTH=8,9,12;BYMONTHDAY=8,15',
                        '2015-09-24T12:00:01', '2030-08-08T12:00:00');
      });
      suite("BYHOUR+BYMINUTE+BYSECOND+BYDAY+BYMONTH+BYMONTHDAY", function() {
        testFastForward('FREQ=MONTHLY;BYHOUR=12,15;BYMINUTE=0,20;BYSECOND=0,25;BYDAY=TU,TH;BYMONTH=8,9,12;BYMONTHDAY=8,15',
                        '2015-09-15T15:20:26', '2015-12-08T12:00:00');
        testFastForward('FREQ=MONTHLY;BYHOUR=12,15;BYMINUTE=0,20;BYSECOND=0,25;BYDAY=TU,TH;BYMONTH=8,9,12;BYMONTHDAY=8,15',
                        '2015-09-15T15:20:20', '2015-09-15T15:20:25');
        testFastForward('FREQ=MONTHLY;BYHOUR=12,15;BYMINUTE=0,20;BYSECOND=0,25;BYDAY=TU,TH;BYMONTH=8,9,12;BYMONTHDAY=8,15',
                        '2015-09-15T12:00:01', '2015-09-15T12:00:25');

        testFastForward('FREQ=MONTHLY;BYHOUR=12,15;BYMINUTE=0,20;BYSECOND=0,25;BYDAY=TU,TH;BYMONTH=8,9,12;BYMONTHDAY=8,15;INTERVAL=10',
                        '2016-09-15T12:00:00', '2030-08-08T12:00:00');
      });
      suite("BYHOUR+BYMINUTE+BYSECOND+BYSETPOS", function() {
        testFastForward('FREQ=MONTHLY;BYHOUR=12,15;BYMINUTE=0,20;BYSECOND=0,25;BYSETPOS=-1',
                        '2015-08-15T12:00:00', '2015-08-15T15:20:25');

        testFastForward('FREQ=MONTHLY;BYHOUR=12,15;BYMINUTE=0,20;BYSECOND=0,25;BYSETPOS=-1;INTERVAL=10',
                        '2015-08-15T12:00:00', '2015-08-15T15:20:25');
      });
    });

    suite("WEEKLY", function() {
      suite('no extra parts', function() {
        testFastForward('FREQ=WEEKLY',
                        '2015-10-02T12:00:00', '2015-10-03T12:00:00');
        testFastForward('FREQ=WEEKLY;INTERVAL=2',
                        '2015-08-16T12:00:00', '2015-08-29T12:00:00');
        testFastForward('FREQ=WEEKLY;INTERVAL=3',
                        '2015-08-16T12:00:00', '2015-09-05T12:00:00');
        testFastForward('FREQ=WEEKLY;INTERVAL=5',
                        '2015-09-03T12:00:00', '2015-09-19T12:00:00');
      });
      suite('BYMONTH', function() {
        testFastForward('FREQ=WEEKLY;BYMONTH=9',
                        '2015-09-01T12:00:00', '2015-09-05T12:00:00');
        testFastForward('FREQ=WEEKLY;BYMONTH=9,10',
                        '2015-10-04T12:00:00', '2015-10-10T12:00:00');
        testFastForward('FREQ=WEEKLY;BYMONTH=12',
                        '2015-09-04T12:00:00', '2015-12-05T12:00:00');
      });
      suite('BYDAY', function() {
        testFastForward('FREQ=WEEKLY;BYDAY=SA',
                        '2015-08-16T12:00:00', '2015-08-22T12:00:00');
        testFastForward('FREQ=WEEKLY;BYDAY=SU',
                        '2015-08-17T12:00:00', '2015-08-23T12:00:00');
        testFastForward('FREQ=WEEKLY;BYDAY=SU',
                        '2015-08-17T12:00:00', '2015-08-23T12:00:00');
        testFastForward('FREQ=WEEKLY;BYDAY=TH',
                        '2015-09-04T12:00:00', '2015-09-10T12:00:00');
        testFastForward('FREQ=WEEKLY;BYDAY=FR,SU',
                        '2015-09-05T12:00:00', '2015-09-06T12:00:00');
      });
      suite('BYMONTH + BYDAY', function() {
        testFastForward('FREQ=WEEKLY;BYDAY=SA;BYMONTH=8',
                        '2015-08-16T12:00:00', '2015-08-22T12:00:00');
        testFastForward('FREQ=WEEKLY;BYDAY=SA;BYMONTH=8,10',
                        '2015-10-16T12:00:00', '2015-10-17T12:00:00');
        testFastForward('FREQ=WEEKLY;BYDAY=SA;BYMONTH=8,10,12',
                        '2015-12-16T12:00:00', '2015-12-19T12:00:00');
      });
    });

    suite("YEARLY", function() {
      suite('no extra parts', function() {
        testFastForward('FREQ=YEARLY',
                        '2016-01-02T12:00:00', '2016-08-15T12:00:00');
        testFastForward('FREQ=YEARLY',
                        '2017-01-02T12:00:00', '2017-08-15T12:00:00');
      });
      suite('BYMONTH', function() {
        testFastForward('FREQ=YEARLY;BYMONTH=3',
                        '2016-01-02T12:00:00', '2016-03-15T12:00:00');
        testFastForward('FREQ=YEARLY;BYMONTH=12',
                        '2016-01-02T12:00:00', '2016-12-15T12:00:00');
        testFastForward('FREQ=YEARLY;BYMONTH=1,12',
                        '2016-02-02T12:00:00', '2016-12-15T12:00:00');
        testFastForward('FREQ=YEARLY;BYMONTH=1,12',
                        '2016-01-01T12:00:00', '2016-01-15T12:00:00');
      });
      suite('BYWEEKNO', function() {
        testFastForward('FREQ=YEARLY;BYWEEKNO=33',
                        '2016-01-01T12:00:00', '2016-08-20T12:00:00');
        testFastForward('FREQ=YEARLY;BYWEEKNO=1',
                        '2016-01-01T12:00:00', '2016-01-09T12:00:00');
        testFastForward('FREQ=YEARLY;BYWEEKNO=52',
                        '2016-01-01T12:00:00', '2016-12-31T12:00:00');
        testFastForward('FREQ=YEARLY;BYWEEKNO=52',
                        '2017-01-01T12:00:00', '2017-12-30T12:00:00');
      });
      suite('BYYEARDAY', function() {
        testFastForward('FREQ=YEARLY;BYYEARDAY=227',
                        '2016-01-01T12:00:00', '2016-08-14T12:00:00');
        testFastForward('FREQ=YEARLY;BYYEARDAY=1',
                        '2016-01-01T12:00:00', '2016-01-01T12:00:00');
        testFastForward('FREQ=YEARLY;BYYEARDAY=-1',
                        '2016-01-01T12:00:00', '2016-12-31T12:00:00');
        testFastForward('FREQ=YEARLY;BYYEARDAY=-1,1',
                        '2016-01-02T12:00:00', '2016-12-31T12:00:00');
      });
      suite('BYMONTHDAY', function() {
        testFastForward('FREQ=YEARLY;BYMONTHDAY=15',
                        '2016-01-01T12:00:00', '2016-08-15T12:00:00');
        testFastForward('FREQ=YEARLY;BYMONTHDAY=15,16',
                        '2016-08-16T12:00:00', '2016-08-16T12:00:00');
        testFastForward('FREQ=YEARLY;BYMONTHDAY=15,16,30',
                        '2016-08-20T12:00:00', '2016-08-30T12:00:00');
      });
      suite('BYDAY', function() {
        testFastForward('FREQ=YEARLY;BYDAY=SA',
                        '2015-09-01T12:00:00', '2015-09-05T12:00:00');
        testFastForward('FREQ=YEARLY;BYDAY=SA,SU',
                        '2015-09-06T12:00:00', '2015-09-06T12:00:00');
        testFastForward('FREQ=YEARLY;BYDAY=1SA',
                        '2015-09-06T12:00:00', '2016-01-02T12:00:00');
        testFastForward('FREQ=YEARLY;BYDAY=-1SA',
                        '2015-09-06T12:00:00', '2015-12-26T12:00:00');
      });
      suite('BYMONTH + BYWEEKNO', function() {
        testFastForward('FREQ=YEARLY;BYMONTH=1;BYWEEKNO=1',
                        '2015-09-01T12:00:00', '2016-01-09T12:00:00');
        testFastForward('FREQ=YEARLY;BYMONTH=1;BYWEEKNO=2',
                        '2015-09-01T12:00:00', '2016-01-16T12:00:00');
        testFastForward('FREQ=YEARLY;BYMONTH=8,9;BYWEEKNO=31,32,33',
                        '2015-09-01T12:00:00', '2016-08-06T12:00:00');
        testFastForward('FREQ=YEARLY;BYMONTH=8,9;BYWEEKNO=31,32,33',
                        '2016-08-10T12:00:00', '2016-08-13T12:00:00');
        testFastForward('FREQ=YEARLY;BYMONTH=8,10;BYWEEKNO=33',
                        '2015-08-16T12:00:00', '2016-08-20T12:00:00');
      });
      suite('BYMONTH + BYYEARDAY', function() {
        testFastForward('FREQ=YEARLY;BYMONTH=1;BYYEARDAY=1',
                        '2015-09-01T12:00:00', '2016-01-01T12:00:00');
        testFastForward('FREQ=YEARLY;BYMONTH=1,12;BYYEARDAY=1,365',
                        '2015-09-01T12:00:00', '2015-12-31T12:00:00');
        testFastForward('FREQ=YEARLY;BYMONTH=1,12;BYYEARDAY=1,365',
                        '2016-01-01T12:00:00', '2016-01-01T12:00:00');
        testFastForward('FREQ=YEARLY;BYMONTH=7;BYYEARDAY=190,191,192,365',
                        '2016-09-01T12:00:00', '2017-07-09T12:00:00');
      });
      suite('BYMONTH + BYMONTHDAY', function() {
        testFastForward('FREQ=YEARLY;BYMONTH=1,12;BYMONTHDAY=1,31',
                        '2016-01-01T12:00:00', '2016-01-01T12:00:00');
        testFastForward('FREQ=YEARLY;BYMONTH=8,10;BYMONTHDAY=15,20',
                        '2015-09-01T12:00:00', '2015-10-15T12:00:00');
        testFastForward('FREQ=YEARLY;BYMONTH=8,10;BYMONTHDAY=15,20',
                        '2015-10-16T12:00:00', '2015-10-20T12:00:00');
      });
      suite('BYMONTH + BYDAY', function() {
        testFastForward('FREQ=YEARLY;BYMONTH=8,10;BYDAY=SA',
                        '2015-08-16T12:00:00', '2015-08-22T12:00:00');
        testFastForward('FREQ=YEARLY;BYMONTH=8,10;BYDAY=SA',
                        '2015-09-16T12:00:00', '2015-10-03T12:00:00');
        testFastForward('FREQ=YEARLY;BYMONTH=8,10;BYDAY=1SA',
                        '2015-09-16T12:00:00', '2015-10-03T12:00:00');
        testFastForward('FREQ=YEARLY;BYMONTH=8,10;BYDAY=3SA',
                        '2015-09-16T12:00:00', '2015-10-17T12:00:00');
      });
      suite('BYDAY + BYWEEKNO', function() {
        testFastForward('FREQ=YEARLY;BYDAY=SA;BYWEEKNO=33',
                        '2015-08-16T12:00:00', '2016-08-20T12:00:00');
        testFastForward('FREQ=YEARLY;BYDAY=SA,SU;BYWEEKNO=33',
                        '2015-08-16T12:00:00', '2015-08-16T12:00:00');
        testFastForward('FREQ=YEARLY;BYDAY=SA,SU;BYWEEKNO=33',
                        '2015-08-17T12:00:00', '2016-08-20T12:00:00');
      });
      suite('BYDAY + YEARDAY', function() {
        testFastForward('FREQ=YEARLY;BYDAY=SA;BYYEARDAY=227',
                        '2015-08-16T12:00:00', '2026-08-15T12:00:00');
        testFastForward('FREQ=YEARLY;BYDAY=SA,SU;BYYEARDAY=227',
                        '2015-08-16T12:00:00', '2016-08-14T12:00:00');
        testFastForward('FREQ=YEARLY;BYDAY=SA,SU;BYYEARDAY=227',
                        '2017-08-16T12:00:00', '2021-08-15T12:00:00');
      });
      suite('BYWEEKNO + BYYEARDAY', function() {
        testFastForward('FREQ=YEARLY;BYWEEKNO=52,53;BYYEARDAY=360',
                        '2015-08-16T12:00:00', '2015-12-26T12:00:00');
        testFastForward('FREQ=YEARLY;BYWEEKNO=1,2;BYYEARDAY=5,11',
                        '2015-08-16T12:00:00', '2016-01-05T12:00:00');
      });
      suite('BYWEEKNO + BYMONTHDAY', function() {
        testFastForward('FREQ=YEARLY;BYWEEKNO=1,2;BYMONTHDAY=8,10',
                        '2015-08-16T12:00:00', '2016-01-08T12:00:00');
        testFastForward('FREQ=YEARLY;BYWEEKNO=1,2;BYMONTHDAY=8,10',
                        '2016-01-09T12:00:00', '2016-01-10T12:00:00');
      });
      suite('BYWEEKNO + BYDAY', function() {
        testFastForward('FREQ=YEARLY;BYWEEKNO=1,2;BYDAY=MO,WE',
                        '2015-08-16T12:00:00', '2016-01-04T12:00:00');
        testFastForward('FREQ=YEARLY;BYWEEKNO=1,2;BYDAY=MO,WE',
                        '2016-01-05T12:00:00', '2016-01-06T12:00:00');
      });
      suite('BYYEARDAY + BYMONTHDAY', function() {
        testFastForward('FREQ=YEARLY;BYYEARDAY=361,362,363,364,365;BYMONTHDAY=30,31',
                        '2015-08-16T12:00:00', '2015-12-30T12:00:00');
        testFastForward('FREQ=YEARLY;BYYEARDAY=361,362,363,364,365;BYMONTHDAY=30,31',
                        '2017-01-01T12:00:00', '2017-12-30T12:00:00');
      });
      suite('BYYEARDAY + BYDAY', function() {
        testFastForward('FREQ=YEARLY;BYYEARDAY=361,362,363,364,365;BYDAY=MO,WE',
                        '2015-08-16T12:00:00', '2015-12-28T12:00:00');
        testFastForward('FREQ=YEARLY;BYYEARDAY=361,362,363,364,365;BYDAY=MO,WE',
                        '2015-12-29T12:00:00', '2015-12-30T12:00:00');
      });
      suite('BYMONTHDAY + BYDAY', function() {
        testFastForward('FREQ=YEARLY;BYMONTHDAY=15,17;BYDAY=MO,SA',
                        '2015-08-16T12:00:00', '2015-08-17T12:00:00');
        testFastForward('FREQ=YEARLY;BYMONTHDAY=15,17;BYDAY=MO,SA',
                        '2015-08-18T12:00:00', '2015-10-17T12:00:00');
      });
    });
  });
});
