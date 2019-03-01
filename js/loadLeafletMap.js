/* global document, L */

import {
    key
} from "./getKey.js";

let active = "";
let startPolyline = null;
let polylines = [];

// Initialize the map
const map = L.map("map", {
    "center": [59.334591, 18.063240],
    "editable": true,
    "zoom": 10
});

L.tileLayer(`https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=${key}`, {
    "accessToken": key,
    "attribution": "Map data &copy; <a href='https://www.openstreetmap" +
        ".org/'>OpenStreetMap</a> contributors, <a href='https://" +
        "creativecommons.org/" +
        "licenses/by-sa/2.0/'>CC-BY-SA</a>, Imagery © <a href='" +
        "https://www.mapbox.com/'>Mapbox</a>",
    "id": "mapbox.streets",
    "maxZoom": 25
}).addTo(map);

const myIcon = L.icon({
    "iconAnchor": [10, 45],
    "iconSize": [38, 45],
    "iconUrl": "img/pump.png",
    "popupAnchor": [1, -45]
});

const item = document.getElementsByClassName("item");

for (let i = 0; i < item.length; i++) {
    item[i].addEventListener("click", (event) => {
        map.eachLayer((layer) => {
            layer.off("click", remove);
            layer.off("click", redraw);
        });

        map.on("click", addMarker);
        for (let i = 0; i < polylines.length; i++) {
            polylines[i].editingDrag.addHooks();
        }
        active = event.srcElement.id;
    });
}

document.getElementById("pipe").addEventListener("click", () => {
    map.off("click", addMarker);

    for (let i = 0; i < polylines.length; i++) {
        polylines[i].editingDrag.addHooks();
    }

    map.eachLayer((layer) => {
        layer.off("click", remove);
        layer.closePopup();

        layer.on("click", redraw);
    });
});

document.getElementById("delete").addEventListener("click", () => {
    map.off("click", addMarker);

    for (let i = 0; i < polylines.length; i++) {
        polylines[i].editingDrag.removeHooks();
    }
    map.eachLayer((layer) => {
        layer.off("click", redraw);
        layer.on("click", remove);
    });
});

document.getElementsByClassName("test")[0].addEventListener("click", () => {
    map.eachLayer((layer) => {
        console.log(layer);
    });
});

/**
 * Adds a marker to the map.
 * @param {object} event event.
 * @returns {void}
 */
function addMarker(event) {
    const marker = new L.Marker(event.latlng, {
        "draggable": "true",
        "icon": myIcon
    }).addTo(map).
    on("drag", movePipe);

    marker.bindPopup(`<select name="model">
    <option value="?"><b>${active}</b></option>
    <option value="?">vattenpump2</option>
    <option value="?">vattenpump3</option>
    <option value="?">vattenpump4</option>
  </select><br><b>Typ:</b> BPS 200<br><b>RSK:</b> 5890162<br><b>ArtikelNr:</b> BPS200<br><b>slang:</b> 32<br><b>invGanga:</b> g 32<br><b>Fas:</b> 1<br><b>Volt:</b> 230<br><b>Motoreffekt:</b> 0.2<br><b>Markström:</b> 1<br><b>varvtal:</b> 2900<br><b>kabeltyp:</b> H05RNF/H07RNF<br><b>kabellängd:</b> 10<br><b>vikt:</b> 5`).openPopup();
}


/**
 * Adds a marker to the map.
 * @param {object} event event.
 * @returns {void}
 */
function movePipe(event) {
    let newLatlng;

    for (let i = 0; i < polylines.length; i++) {
        if (event.target._leaflet_id == polylines[i].connected_with.first) {
            newLatlng = polylines[i].getLatLngs();
            newLatlng.shift();
            newLatlng.unshift(event.latlng);

            polylines[i].setLatLngs(newLatlng);
        } else if (event.target._leaflet_id == polylines[i].connected_with.last) {
            newLatlng = polylines[i].getLatLngs();
            newLatlng.pop();
            newLatlng.push(event.latlng);
            polylines[i].setLatLngs(newLatlng);
        }
    }
}

/**
 * Adds a marker to the map.
 * @param {object} event event.
 * @returns {void}
 */
function remove(e) {
    polylines = arrayRemove(polylines, e.target); // körs varje gång man tar bort ett object även om det inte är en polyline
    e.target.removeFrom(map);
}

/**
 * Draws polylines.
 * @param {object} event event.
 * @returns {void}
 */
function redraw(event) {
    event.target.closePopup();
    for (let i = 0; i < polylines.length; i++) {
        polylines[i].editingDrag.removeHooks();
        polylines[i].on('click', redraw);
    }

    if (startPolyline != null) {
        const temp = new L.polyline([startPolyline.latlng, event.latlng], {
            "edit_with_drag": true,
            "vertices": {
                "first": false,
                "last": false,
                "middle": true,
                "insert": true,
                "destroy": true
            }
        });



        temp.connected_with = {
            "first": startPolyline.id,
            "last": event.sourceTarget._leaflet_id
        };

        polylines.push(temp);
        polylines[polylines.length - 1].addTo(map);
        console.log("last");


        // Få längden på polylines fungerar bara när man placerar ut den första gången
        /*
		let previousPoint;

        temp.getLatLngs().forEach((latLng) => {
            if (previousPoint) {
                polylines[polylines.length - 1].bindPopup(`Distance from previous point: ${
                    previousPoint.distanceTo(latLng).toFixed(2)
                } meter(s)`).addTo(map).
                openPopup();
            }
            previousPoint = latLng;
        });
		*/
        startPolyline = null;
    } else {
        console.log("first");
        startPolyline = [];
        startPolyline.latlng = event.latlng;
        startPolyline.id = event.sourceTarget._leaflet_id;
    }
}


/**
 * Changes classname on active button.
 * @returns {void}
 */
function activeObj() {
    const obj = document.getElementsByClassName("obj");

    for (let i = 0; i < obj.length; i++) {
        obj[i].addEventListener("click", function activeClassName() {
            const current = document.getElementsByClassName("active");

            if (current.length > 0) {
                current[0].className =
                    current[0].className.replace(" active", "");
            }
            this.className += " active";
        });
    }
}
activeObj();

/**
 * Adds a marker to the map.
 * @param {object} event event.
 * @returns {void}
 */
function arrayRemove(arr, value) {

    return arr.filter((ele) => ele != value);

}
