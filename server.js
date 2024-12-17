const express = require('express');
const session = require('express-session');
const path = require('path');
const app = express();
const fs = require('fs');

app.use(session({
  secret: 'secret',
  resave: true,
  saveUninitialized: true
}));

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const dataFilePath = path.join(__dirname, 'data.json');

const LOCATIONS = ['Krefeld', 'Gladbach'];
const FAECHER = ['ITS', 'MA', 'SWE', 'WIN', 'DNE'];
const EVENT_TYPES = ['Vorlesung', 'Praktikum', 'Übung'];
const EVENT_DURATIONS = { 'Vorlesung': 2, 'Praktikum': 4, 'Übung': 2 };
const WEEK_DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];
const WEEK_DAY_ORDER = { 'Montag': 1, 'Dienstag': 2, 'Mittwoch': 3, 'Donnerstag': 4, 'Freitag': 5 };

function readData() {
  const rawData = fs.readFileSync(dataFilePath);
  return JSON.parse(rawData);
}

function writeData(data) {
  fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.post('/generateSchedule', (req, res) => {
  const data = readData();
  resetWorkingHours(data.Lehrpersonen);
  generateAndFillSchedule(data);
  checkCapacities(data);
  data.Veranstaltungen.sort((a, b) => {
    if (WEEK_DAY_ORDER[a.Tag] === WEEK_DAY_ORDER[b.Tag]) {
      return a.Uhrzeit.localeCompare(b.Uhrzeit);
    }
    return WEEK_DAY_ORDER[a.Tag] - WEEK_DAY_ORDER[b.Tag];
  });
  writeData(data);
  res.sendStatus(200);
});

app.post('/addlehrperson', (req, res) => {
  const newLehrperson = req.body;
  const data = readData();
  data.Lehrpersonen.push(newLehrperson);
  writeData(data);
  res.sendStatus(200);
});

app.post('/deletelehrperson', (req, res) => {
  const { Name } = req.body;
  const data = readData();
  data.Lehrpersonen = data.Lehrpersonen.filter(lehrperson => lehrperson.Name !== Name);
  writeData(data);
  res.sendStatus(200);
});

app.post('/reportSick', (req, res) => {
  const { Name, EndDate } = req.body;
  const data = readData();
  const lehrperson = data.Lehrpersonen.find(lehrperson => lehrperson.Name === Name);
  if (lehrperson) {
    lehrperson.Krankheitsstatus = true;
    lehrperson.Krankheitsende = EndDate;
    const endDate = new Date(EndDate);
    const currentDate = new Date();
    const krankheitsdauer = Math.ceil((endDate - currentDate) / (1000 * 60 * 60 * 24)); // calculate days
    lehrperson.Krankheitsdauer = krankheitsdauer;
    reassignEvents(data, lehrperson.Name);
  }
  writeData(data);
  res.sendStatus(200);
});

app.get('/schedule', (req, res) => {
  const data = readData();
  res.json(data.Veranstaltungen);
});

app.get('/lehrpersons', (req, res) => {
  const data = readData();
  res.json(data.Lehrpersonen);
});

app.listen(3000, () => {
  console.log('Server läuft auf Port 3000');
});

function resetWorkingHours(lehrpersonen) {
  lehrpersonen.forEach(lehrperson => {
    lehrperson.Arbeitszeit = 0;
  });
}

function decrementKrankheitsdauer(lehrpersonen) {
  const currentDate = new Date();
  lehrpersonen.forEach(lehrperson => {
    if (lehrperson.Krankheitsstatus) {
      const endDate = new Date(lehrperson.Krankheitsende);
      if (currentDate >= endDate) {
        lehrperson.Krankheitsstatus = false;
        lehrperson.Krankheitsende = null;
        lehrperson.Krankheitsdauer = null;
      } else {
        const krankheitsdauer = Math.ceil((endDate - currentDate) / (1000 * 60 * 60 * 24)); // calculate days
        lehrperson.Krankheitsdauer = krankheitsdauer;
      }
    }
  });
}

function generateAndFillSchedule(data) {
  decrementKrankheitsdauer(data.Lehrpersonen);

  data.Veranstaltungen = []; // Clear previous schedule

  // Helper function to get time in HH:MM format
  function getTimeString(hour) {
    return hour.toString().padStart(2, '0') + ":00";
  }

  // Helper function to add event
  function addEvent(lehrperson, fach, eventType, eventDuration, day, location) {
    // Find the latest end time of the events for the lehrperson on the same day
    const lehrpersonEvents = data.Veranstaltungen.filter(event => event.Dozent === lehrperson.Name && event.Tag === day);
    const lastEvent = lehrpersonEvents.length > 0 ? lehrpersonEvents[lehrpersonEvents.length - 1] : null;
    let startTime = 8;
    
    if (lastEvent) {
      const lastEndHour = parseInt(lastEvent.Uhrzeit.split(' - ')[1].split(':')[0]);
      startTime = lastEndHour + 2; // Add two hours for the required break
    }

    const endTime = startTime + eventDuration;

    // Add working hours for travel if the location has changed
    if (lastEvent && lastEvent.Standort !== location) {
      lehrperson.Arbeitszeit += 2; // Two hours for travel time
    }

    // Check if the new event's end time exceeds 16 hours of work time
    if (lehrperson.Arbeitszeit + eventDuration + (lastEvent && lastEvent.Standort !== location ? 2 : 0) <= 16) {
      lehrperson.Arbeitszeit += eventDuration;

      data.Veranstaltungen.push({
        Fach: fach,
        Typ: eventType,
        Tag: day,
        Uhrzeit: `${getTimeString(startTime)} - ${getTimeString(endTime)}`,
        Dozent: lehrperson.Name,
        Standort: location
      });
    }
  }

  // Main schedule generation
  WEEK_DAYS.forEach(day => {
    FAECHER.forEach(fach => {
      const eventType = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
      const eventDuration = EVENT_DURATIONS[eventType];
      const availablelehrpersonen = data.Lehrpersonen.filter(lehrperson =>
        !lehrperson.Krankheitsstatus && lehrperson.Arbeitszeit + eventDuration <= 16);

      if (availablelehrpersonen.length > 0) {
        const lehrperson = availablelehrpersonen[Math.floor(Math.random() * availablelehrpersonen.length)];
        const location = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
        addEvent(lehrperson, fach, eventType, eventDuration, day, location);
      }
    });
  });

  // Fill remaining hours for professors
  for (const lehrperson of data.Lehrpersonen) {
    while (lehrperson.Arbeitszeit < 16 && lehrperson.Krankheitsstatus == false) {
      for (const day of WEEK_DAYS) {
        for (const fach of FAECHER) {
          const eventType = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
          const eventDuration = EVENT_DURATIONS[eventType];
          
          // Find the latest end time of the events for the lehrperson on the same day
          const lehrpersonEvents = data.Veranstaltungen.filter(event => event.Dozent === lehrperson.Name && event.Tag === day);
          const lastEvent = lehrpersonEvents.length > 0 ? lehrpersonEvents[lehrpersonEvents.length - 1] : null;
          let startTime = 8;
          
          if (lastEvent) {
            const lastEndHour = parseInt(lastEvent.Uhrzeit.split(' - ')[1].split(':')[0]);
            startTime = lastEndHour + 2; // Add two hours for the required break
          }

          const endTime = startTime + eventDuration;

          // Add working hours for travel if the location has changed
          if (lastEvent && lastEvent.Standort !== location) {
            lehrperson.Arbeitszeit += 2; // Two hours for travel time
          }

          // Check if the new event's end time exceeds 16 hours of work time
          if (lehrperson.Arbeitszeit + eventDuration + (lastEvent && lastEvent.Standort !== location ? 2 : 0) <= 16) {
            lehrperson.Arbeitszeit += eventDuration;

            const location = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)]; // Define location here
            data.Veranstaltungen.push({
              Fach: fach,
              Typ: eventType,
              Tag: day,
              Uhrzeit: `${getTimeString(startTime)} - ${getTimeString(endTime)}`,
              Dozent: lehrperson.Name,
              Standort: location
            });

            if (lehrperson.Arbeitszeit >= 16) {
              break;
            }
          }
        }
        if (lehrperson.Arbeitszeit >= 16) {
          break;
        }
      }
      if (lehrperson.Arbeitszeit >= 16) {
        break;
      }
    }
  }
}

function reassignEvents(data, sicklehrpersonenName) {
  data.Veranstaltungen.forEach(event => {
    if (event.Dozent === sicklehrpersonenName) {
      const availablelehrpersonen = data.Lehrpersonen.filter(lehrperson =>
        !lehrperson.Krankheitsstatus && lehrperson.Arbeitszeit + EVENT_DURATIONS[event.Typ] <= 16);

      if (availablelehrpersonen.length > 0) {
        const newLehrperson = availablelehrpersonen[Math.floor(Math.random() * availablelehrpersonen.length)];
        newLehrperson.Arbeitszeit += EVENT_DURATIONS[event.Typ];
        event.Dozent = newLehrperson.Name;
      }
    }
  });
}

function checkCapacities(data) {
  const overCapacitylehrpersonen = data.Lehrpersonen.filter(lehrperson => !lehrperson.Krankheitsstatus && lehrperson.Arbeitszeit < 16);
  if (overCapacitylehrpersonen.length > 0) {
    console.warn('Überkapazität erreicht: Folgende lehrpersonen haben weniger als 16 Stunden:');
    overCapacitylehrpersonen.forEach(lehrperson => console.warn(`lehrpersonen ${lehrperson.Name}`));
  } else {
    console.warn('Unterkapazität erreicht: Nicht genügend lehrpersonen verfügbar.');
  }
}
