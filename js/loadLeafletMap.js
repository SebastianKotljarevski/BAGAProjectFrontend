import {
    key
} from "./getKey.js";

var active = "";

// Initialize the map
const map = L.map("map", {
    center: [51.505, -0.09],
    zoom: 10
});

L.tileLayer("https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=" + key, {
    attribution: "Map data &copy; <a href='https://www.openstreetmap.org/'>OpenStreetMap</a> contributors, <a href='https://creativecommons.org/licenses/by-sa/2.0/'>CC-BY-SA</a>, Imagery © <a href='https://www.mapbox.com/'>Mapbox</a>",
    accessToken: key,
    maxZoom: 18,
    id: "mapbox.streets"
}).addTo(map);

function addMarker(e) {
    const marker = L.marker(e.latlng).addTo(map);
    marker.bindPopup(e.latlng.toString() + ", " + active).openPopup();
}

const button = document.getElementsByClassName("obj");

for (var i = 0; i < button.length; i++) {
    button[i].addEventListener("click", function(event){
        active = event.srcElement.id;
    });
}

map.on('click', addMarker);
