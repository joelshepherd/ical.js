suite('google birthday events', function() {
  var icsData;

  suiteSetup(async function() {
    icsData = await testSupport.loadSample('google_birthday.ics');
  });

  test('expanding malformatted recurring event', function(done) {
    // just verify it can parse forced types
    var parser = new ICAL.ComponentParser();
    var primary;
    var exceptions = [];

    var expectedDates = [
      new Date(2012, 11, 10),
      new Date(2013, 11, 10),
      new Date(2014, 11, 10)
    ];

    parser.onevent = function(event) {
      if (event.isRecurrenceException()) {
        exceptions.push(event);
      } else {
        primary = event;
      }
    };

    parser.oncomplete = function() {
      exceptions.forEach(function(item) {
        primary.relateException(item);
      });

      var iter = primary.iterator();
      var next;
      var dates = [];
      while ((next = iter.next())) {
        dates.push(next.toJSDate());
      }

      assert.deepEqual(
        dates,
        expectedDates
      );

      done();
    };

    parser.process(icsData);
  });
});
