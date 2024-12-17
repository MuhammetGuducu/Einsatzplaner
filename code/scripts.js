const scheduleTableBody = document.querySelector("#scheduleTable tbody");

function ladeEinsatzplan() {
  const xhr = new XMLHttpRequest();
  xhr.open("GET", "/schedule", true);
  xhr.onload = function() {
    if (xhr.status === 200) {
      const einsatzplan = JSON.parse(xhr.responseText);
      renderEinsatzplan(einsatzplan);
    } else {
      alert("Fehler beim Abrufen des Einsatzplans.");
    }
  };
  xhr.send();
}

function renderEinsatzplan(einsatzplan) {
  scheduleTableBody.innerHTML = '';
  einsatzplan.forEach(event => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${event.Fach}</td>
      <td>${event.Typ}</td>
      <td>${event.Tag}</td>
      <td>${event.Uhrzeit}</td>
      <td>${event.Dozent}</td>
      <td>${event.Standort}</td>
    `;
    scheduleTableBody.appendChild(row);
  });
}

// Initialer Abruf des Einsatzplans bei Seitenlade
ladeEinsatzplan();
