document.addEventListener('DOMContentLoaded', function () {
  fetchTeachers();
});

const teacherForm = document.getElementById("teacherForm");
const deleteTeacherForm = document.getElementById("deleteTeacherForm");
const sickTeacherForm = document.getElementById("sickTeacherForm");

teacherForm.addEventListener("submit", function(event) {
  event.preventDefault();
  addTeacher();
});

deleteTeacherForm.addEventListener("submit", function(event) {
  event.preventDefault();
  deleteTeacher();
});

sickTeacherForm.addEventListener("submit", function(event) {
  event.preventDefault();
  reportSick();
});

function generateSchedule() {
  fetch('/generateSchedule', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  }).then(response => {
    if (response.ok) {
      alert("Einsatzplan wurde erzeugt/aktualisiert.");
    } else {
      alert("Fehler beim Erzeugen/Aktualisieren des Einsatzplans.");
    }
  });
}

function createScheduleImage() {
  // Implementiere Funktion um ein Bild vom Einsatzplan zu erstellen und an das Schwarze Brett zu hängen.
  alert("Bild vom Einsatzplan wurde erstellt und an das Schwarze Brett gehängt.");
}

function addTeacher() {
  const name = document.getElementById("teacherName").value;
  const newTeacher = {
    Name: name,
    Krankheitsstatus: false,
    Krankheitsdauer: null,
    Krankheitsende: null,
    Arbeitszeit: 0
  };

  fetch('/addlehrperson', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(newTeacher)
  }).then(response => {
    if (response.ok) {
      alert("Lehrperson hinzugefügt.");
      teacherForm.reset();
      fetchTeachers();
    } else {
      alert("Fehler beim Hinzufügen der Lehrperson.");
    }
  });
}

function deleteTeacher() {
  const name = document.getElementById("deleteTeacherName").value;

  fetch('/deletelehrperson', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ Name: name })
  }).then(response => {
    if (response.ok) {
      alert("Lehrperson gelöscht.");
      fetchTeachers();
    } else {
      alert("Fehler beim Löschen der Lehrperson.");
    }
  });
}

function reportSick() {
  const name = document.getElementById("sickTeacherName").value;
  const endDate = document.getElementById("sickEndDate").value;

  fetch('/reportSick', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ Name: name, EndDate: endDate })
  }).then(response => {
    if (response.ok) {
      alert("Lehrperson krankgemeldet.");
      fetchTeachers();
    } else {
      alert("Fehler beim Krankmelden der Lehrperson.");
    }
  });
}

function fetchTeachers() {
  fetch('/lehrpersons').then(response => response.json()).then(data => {
    const deleteTeacherSelect = document.getElementById("deleteTeacherName");
    const sickTeacherSelect = document.getElementById("sickTeacherName");

    deleteTeacherSelect.innerHTML = '';
    sickTeacherSelect.innerHTML = '';

    data.forEach(teacher => {
      const option = document.createElement('option');
      option.value = teacher.Name;
      option.textContent = teacher.Name;

      deleteTeacherSelect.appendChild(option.cloneNode(true));
      sickTeacherSelect.appendChild(option);
    });
  });
}
