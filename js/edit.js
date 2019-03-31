/* global L, */
export let isEdit = null;
let tempPolylineArray = [];
let housePopup =
    `<div class="housePopup">
    <select>
    <option value="Hus">Hus</option>
    <option value="Garage">Garage</option>
    <option value="Restaurang">Restaurang</option>
    <option value="Sommarstuga">Sommarstuga</option>
    </select>

    <form action="">
    Personer per hushåll: <input type="text" name="per" value="5"><br>
    Vatten per person/dygn: <input type="text" name="cons" value="150L"><br>
    <input type="button" value="Ändra">
    </form>
    </div>`;

//imports the map object
import {
    map
} from "./loadLeafletMap.js";

import {
    add,
    polylines,
    markers,
    polygons,
    polygon,
    guideline,
    clear,
    calcLengthFromPipe
} from "./add.js";

import {
    jsonData
} from "../json/jsonSave.js";

export const edit = {
    /**
     * moveMarker - Moves a marker and connected polyline follows.
     *
     * @param {object} event
     * @returns {void}
     */
    moveMarker: (event) => {
        //get each polyline
        polylines.eachLayer((polyline) => {
            //check if polylines are connected to a marker, by first point and last point.
            if (event.target._leaflet_id === polyline.connected_with.first) {
                //if polyline is connected with marker change lat lng to match marker
                let newLatlng = polyline.getLatLngs();

                newLatlng.shift();
                newLatlng.unshift(event.latlng);

                polyline.setLatLngs(newLatlng);
            } else if (event.target._leaflet_id === polyline.connected_with
                .last) {
                let newLatlng = polyline.getLatLngs();

                newLatlng.pop();
                newLatlng.push(event.latlng);
                polyline.setLatLngs(newLatlng);
            }
        });
    },

    /**
     * editPolylines - Makes polylines editable by adding hooks and dragging.
     * library?
     *
     * @returns {void}
     */
    polylines: () => {
        clear();

        polylines.eachLayer((polyline) => {
            polyline.editingDrag.addHooks();
            tempPolylineArray.push(polyline._latlngs.length);
        });

        isEdit = true;
    },

    /**
     * stopEdit - Stops the drawing of a polygon.
     *
     * @returns {void}
     */
    stopDrawingHouse: () => {
        //if user is still drawing a polygon, stop it.
        if (guideline != null && polygon != null) {
            let addr;

            L.esri.Geocoding.reverseGeocode()
                .latlng(polygon._latlngs[0][0])
                .run((error, result) => {
                    addr = result.address.Match_addr;

                    polygon.bindPopup(`<b>${addr}</b>` + housePopup);
                    map.off('mousemove', add.guideLine);
                    guideline.remove();
                    clear();
                });
        }
    },

    /**
     * clearMapsEvents - Clear the map from events.
     *
     * @returns {void}
     */
    clearMapsEvents: () => {
        //Gets each polylines and removes the "editing hooks".
        polylines.eachLayer((polyline) => {
            polyline.closePopup();
            polyline.editingDrag.removeHooks();
        });

        //Turn off click events for markers and polylines.
        map.off("click", add.marker);
        map.off('click', add.polygone);
        //If polylines has been edited
        if (isEdit == true) {
            var i = 0;

            //for each element in polylines
            polylines.eachLayer((polyline) => {
                //if amount of points has changed
                if (polyline._latlngs.length != tempPolylineArray[i]) {
                    //Calculates new length of pipe
                    calcLengthFromPipe(polyline);
                    polyline.bindTooltip("Längd: " + Math.round(polyline.getLength *
                            100) /
                        100 +
                        "m");
                }
                i++;
            });

            isEdit = null;
        }

        //remove guideline from polygon.
        if (guideline != null) {
            edit.stopDrawingHouse();
        }
        document.getElementById("map").style.cursor = "grab";

        //Closes popups and turns off click events for remove and addPipe.
        map.closePopup();
        map.eachLayer((layer) => {
            layer.off("click", edit.remove);
            layer.off("click", add.pipe);
        });
    },

    /**
     * remove - Removes objects from the map.
     *
     * @param {object} event
     * @returns {void}
     */
    remove: (event) => {
        //remove polylines, markers and polygons when clicked
        polylines.removeLayer(event.sourceTarget);
        markers.removeLayer(event.sourceTarget);
        polygons.removeLayer(event.sourceTarget);
    },

    /**
     * save - Saves the objects from the map in a json format.
     *
     * @returns {void}
     */
    save: () => {
        const jsonArray = [];

        //loop through all polylines and save them in a json format
        polylines.eachLayer((polyline) => {
            let temp = {
                "coordinates": polyline._latlngs,
                "type": "polyline",
                "connected_with": polyline.connected_with,
                "options": polyline.options,
                "popup": polyline.getPopup().getContent(),
            };

            jsonArray.push(temp);
        });

        //loop through all markers and save them in a json format
        markers.eachLayer((marker) => {
            let temp = {
                "coordinates": marker._latlng,
                "type": "marker",
                "options": marker.options,
                "id": marker._leaflet_id,
                "popup": marker.getPopup().getContent()
            };

            jsonArray.push(temp);
        });

        polygons.eachLayer((polygon) => {
            let temp = {
                "coordinates": polygon._latlngs,
                "type": "polygon",
                "options": polygon.options,
                "id": polygon.id,
                "popup": polygon.getPopup().getContent()
            };

            jsonArray.push(temp);
        });

        const myJSON = JSON.stringify(jsonArray);

        console.log(myJSON);
    },

    /**
     * load - Load objects(markers, polylines, polygons) to the map using json
     * data
     *
     * @returns {void}
     */
    load: () => {
        const savedData = jsonData;
        //const jsonLoad = JSON.parse(jsonData)
        let icon;
        let newObj;

        //Loop through json data.
        for (let i = 0; i < savedData.length; i++) {
            switch (savedData[i].type) {
                //if marker add it to the map with its options
                case "marker":
                    icon = L.icon(savedData[i].options.icon
                        .options);

                    savedData[i].options.icon = icon;
                    newObj = new L.Marker(savedData[i].coordinates,
                        savedData[i].options).addTo(map).on("drag",
                        edit.moveMarker);

                    newObj._leaflet_id = savedData[i].id;
                    newObj.bindPopup(savedData[i].popup);

                    markers.addLayer(newObj);
                    break;
                    //if polyline
                case "polyline":
                    //get polyline options and add it to an object
                    newObj = L.polyline(savedData[i]
                        .coordinates, savedData[i].options);
                    newObj.connected_with = savedData[i].connected_with;
                    newObj.bindPopup(savedData[i].popup);

                    //add to map
                    polylines.addLayer(newObj).addTo(map);
                    break;
                case "polygon":
                    newObj = L.polygon(savedData[i].coordinates, savedData[i].options);
                    newObj.bindPopup(savedData[i].popup);

                    polygons.addLayer(newObj).addTo(map);
                    break;
            }
        }
    },

};
