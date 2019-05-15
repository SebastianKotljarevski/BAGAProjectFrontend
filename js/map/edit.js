/* global L, calculations, configuration, API */
export let isEdit = null;
let tempPolylineArray = [];

//imports the map object
import { map, token, icons, projectInfo } from "./loadLeafletMap.js";

import { add, polylines, markers, polygons } from "./add.js";

import { show, mouseCoord } from "./show.js";

import { popup } from "./popup.js";

import { Marker, House, Pipe } from "./classes.js";

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
            if (event.target.id === polyline.connected_with.first) {
                //if polyline is connected with marker change lat lng to match marker
                let newLatlng = polyline.getLatLngs();

                newLatlng.shift();
                newLatlng.unshift(event.latlng);

                polyline.setLatLngs(newLatlng);
                polyline.decorator.setPaths(newLatlng);
            } else if (event.target.id === polyline.connected_with.last) {
                let newLatlng = polyline.getLatLngs();

                newLatlng.pop();
                newLatlng.push(event.latlng);

                polyline.setLatLngs(newLatlng);
                polyline.decorator.setPaths(newLatlng);
            }

            event.target.setPopupContent(popup.marker(event.target.attributes) + popup.changeCoord({
                lat: event.latlng.lat,
                lng: event.latlng.lng
            }));

            edit.warning.unsavedChanges(true);
        });
    },

    /**
     * polylines - Makes polylines editable by adding hooks and dragging.
     * library?
     *
     * @returns {void}
     */
    polylines: () => {
        polylines.eachLayer((polyline) => {
            polyline.editingDrag.addHooks();
            polyline.decorator.removeFrom(map);
            tempPolylineArray.push(polyline._latlngs.length);
        });

        edit.warning.unsavedChanges(true);
        isEdit = true;
    },

    /**
     * clearMapsEvents - Clear the map from events.
     *
     * @returns {void}
     */
    clearMapsEvents: () => {
        //Gets each polylines and removes the "editing hooks".

        //Turn off click events for markers and polylines.
        map.off("click", add.marker);
        map.off('click', add.polygone);

        //If polylines has been edited
        if (isEdit == true) {
            var i = 0;
            //for each element in polylines

            polylines.eachLayer(async (polyline) => {
                polyline.editingDrag.removeHooks();
                polyline.decorator.addTo(map);
                polyline.decorator.setPaths(polyline._latlngs);

                //if amount of points has changed
                if (polyline._latlngs.length != tempPolylineArray[i++]) {
                    polyline.elevation = await polyline.updateElevation(polyline._latlngs);
                    polyline.bindTooltip("Längd: " + Math.round(polyline.length * 100) /
                        100 + "m" + "<br>Statisk höjd: " +
                        (polyline.elevation.highest - polyline.elevation.first).toFixed(
                            1)
                    );
                }
            });
            isEdit = null;
            if (mouseCoord != null) {
                map.on('mousemove', show.mouseCoordOnMap);
            }
        }

        //Closes popups and turns off click events for remove and addPipe.
        map.closePopup();
        map.eachLayer((layer) => {
            if (layer._popup != null) { layer._popup.options.autoPan = true; }

            layer.off("click", edit.remove);
            layer.off("click", add.pipe);
        });
        document.getElementById("myMap").style.cursor = "grab";
    },

    /**
     * remove - Removes objects from the map.
     *
     * @param {object} event
     * @returns {void}
     */
    remove: (event) => {
        //remove polylines, markers and polygons when clicked
        polylines.removeLayer(event.target);
        markers.removeLayer(event.target);
        polygons.removeLayer(event.target);

        edit.warning.unsavedChanges(true);
    },

    /**
     * save - Saves the objects from the map in a json format.
     *
     * @param {string} version version number the user wants to save the project under
     * @returns {void}
     */
    save: async (version) => {
        let json = [];
        let temp;

        temp = {
            zoom: map.getZoom(),
            center: map.getCenter()
        };

        json.push(temp);

        //loop through all polylines and save them in a json format
        polylines.eachLayer((polyline) => {
            temp = {
                coordinates: polyline._latlngs,
                type: "polyline",
                connected_with: polyline.connected_with,
                elevation: polyline.elevation,
                length: polyline.length,
                tilt: polyline.tilt,
                material: polyline.material,
                dimension: polyline.dimension,
                pipeType: polyline.type,
            };

            json.push(temp);
        });

        //loop through all markers and save them in a json format
        markers.eachLayer((marker) => {
            temp = {
                coordinates: { lat: marker._latlng.lat, lng: marker._latlng.lng },
                type: "marker",
                id: marker.id,
                capacity: marker.capacity,
                attributes: marker.attributes,
            };

            json.push(temp);
        });

        polygons.eachLayer((polygon) => {
            temp = {
                coordinates: polygon._latlngs,
                type: "polygon",
                definition: polygon.definition,
                id: polygon.id,
                address: polygon.address,
                nop: polygon.nop,
                flow: polygon.flow,
                color: polygon.options.color
            };

            json.push(temp);
        });

        if (version == projectInfo.version) {
            let id = new URL(window.location.href).searchParams.get('id');

            await API.post(`${configuration.apiURL}/proj/update/data/${id}?token=${token}`,
                'application/json', JSON.stringify(json));

            edit.warning.unsavedChanges(false);
        } else {
            projectInfo.version = version;

            let response = await API.post(
                `${configuration.apiURL}/proj/insert?token=${token}`,
                'application/json', JSON.stringify(projectInfo));

            await API.post(
                `${configuration.apiURL}/proj/update/data/${response._id}?token=${token}`,
                'application/json', JSON.stringify(json));

            edit.warning.unsavedChanges(false);
            document.location.href = `map.html?id=${response._id}`;
        }
    },

    /**
         * load - Load objects(markers, polylines, polygons) to the map using json data.
         *
         * @returns {void}
         */
    load: (json) => {
        let icon;
        let newObj;
        let popup;

        map.setView(json[0].center, json[0].zoom);

        //Loop through json data.
        for (let i = 1; i < json.length; i++) {
            switch (json[i].type) {
                //if marker add it to the map with its options
                case "marker":
                    icon = icons.find(element => element.category == json[i].attributes.Kategori);
                    newObj = new Marker(json[i].coordinates, json[i].attributes, icon.icon,
                        json[i].capacity, json[i].id);
                    break;
                    //if polyline
                case "polyline":
                    newObj = new Pipe(json[i].coordinates, ["", ""], json[i].pipeType,
                        json[i].connected_with.first);
                    newObj.draw(
                        json[i].connected_with.last,
                        null,
                        json[i].elevation,
                        json[i].material,
                        json[i].dimension,
                        json[i].tilt
                    );
                    break;
                case "polygon":
                    newObj = new House(json[i].coordinates[0], ["", ""], json[i].color);
                    popup = [
                        json[i].address,
                        json[i].definition,
                        json[i].nop,
                        json[i].flow,
                        json[i].color
                    ];

                    newObj.drawFromLoad(json[i].coordinates, popup);
                    break;
            }
        }
    },

    /**
         * warning - Warning message object.
         *
         * @returns {void}
         */
    warning: {
        /**
             * unsavedChanges - Display a warning box when user tries to leave the page that some
             * 				  - information may not be saved if user exit the page.
             *				  - Uses window.onbeforeunload.
             * @returns {void}
             */
        unsavedChanges: (value) => {
            if (value) {
                window.onbeforeunload = () => {
                    return "Are you sure you want to navigate away?";
                };
            } else {
                window.onbeforeunload = () => {};
            }
        },

        pressure: async (element) => {
            let all = [];
            let total;
            let flow;
            let pumps = await API.get(
                `${configuration.apiURL}/obj/type/Pump?token=${token}`);

            polylines.eachLayer((polyline) => {
                all.push(polyline);
            });
            markers.eachLayer((marker) => {
                all.push(marker);
            });
            polygons.eachLayer((polygon) => {
                all.push(polygon);
            });

            let first = all.find(find => find.id == element.connected_with.first);
            let last = all.find(find => find.id == element.connected_with.last);

            switch (first.constructor) {
                case L.Polygon:
                    flow = (first.nop * first.flow) / 86400;
                    last.capacity += parseFloat(flow.toFixed(2));
                    calculateNextPolyline(last, 'first');
                    break;

                case L.Marker:
                    if (first.capacity > 0) {
                        if (first.attributes.Kategori == "Pumpstationer") {
                            total = calculateTotalPressure(
                                first.capacity,
                                element.dimension.inner,
                                element.length,
                                element.tilt,
                            );

                            calculateLast(first, last, pumps, total, element.dimension.inner);
                        } else if (first.attributes.Kategori == "Förgrening") {
                            let polyline = findNextPolyline(first, 'last');

                            let temp = markers.getLayers();
                            let marker = temp.find(find =>
                                find.id == polyline.connected_with.first);

                            if (marker != null) {
                                if (marker.attributes.Kategori == "Pumpstationer") {
                                    edit.warning.pressure(polyline);
                                }
                            }

                            last.capacity = first.capacity;
                            calculateNextPolyline(last, 'first');
                        } else {
                            last.capacity = first.capacity;
                        }
                    }

                    break;
            }
        }
    },
};


/**
 * calculateNextPolyline - if polyline is found run pressure function on new polyline
 *
 * @param {L.Marker} element element that is connected with polyline
 * @param {string}   value   determines if polyline is connected with first or last point
 */
export let calculateNextPolyline = (element, value) => {
    let find = findNextPolyline(element, value);

    if (find != null) {
        edit.warning.pressure(find);
    }
};

/**
 * findNextPolyline - return next connected polyline that are connected with element
 *
 * @param {L.Marker} element element that is connected with polyline
 * @param {string}   value   determines if polyline is connected with first or last point
 *
 * @returns {L.Polyline} if polyline is found
 * @returns {null}		 If polyline is not found
 */
let findNextPolyline = (element, value) => {
    let temp = polylines.getLayers();

    return temp.find(find => find.connected_with[value] == element.id);
};

/**
 * calculateTotalPressure - Calculates total pressure by first calculate pressure loss by using
 * 						  - calculations.calcPressure function.
 * 						  - Secound calculation is total pressure.
 * 						  - Lastly we send back result with two decimals and in float form
 *
 * @param {float}  capacity  Amount of water
 * @param {string} dimension Inner dimension of selected pipe
 * @param {string} length    Total length of selected pipe
 * @param {string} height    Static height of selected pipe
 *
 * @returns {float} returns result from the calculations
 */
let calculateTotalPressure = (capacity, dimension, length, height) => {
    let mu = 0.1;
    let loss = calculations.calcPressure(
        parseFloat(capacity),
        parseFloat(mu),
        parseFloat(dimension),
        parseFloat(length)
    );

    let result = calculations.totalPressure(parseFloat(loss), parseFloat(height));

    return parseFloat(result.toFixed(2));
};


/**
 * calculateLast - Manage different scenarios on the last object that are connected to polyline
 * 				 - Biggest alteration is when the last object is a branch connection
 *
 * @param {L.Marker} first     The marker that have the pump inside it
 * @param {object}   last      The last object that we are handing in the switch case
 * @param {object}   pumps     All the pumps that the database have
 * @param {float} 	 total     total pressure that are calculated beforehand
 * @param {string} 	 dimension Inner dimension of the selected pipe
 *
 * @returns {void}
 */
let calculateLast = (first, last, pumps, total, dimension) => {
    let total2;
    let combinedPressure;
    let nextPolyline;

    switch (last.constructor) {
        case L.Marker:
            if (last.attributes.Kategori == "Pumpstationer") {
                last.capacity = first.capacity;
                getResults(first, pumps, total, dimension);
                calculateNextPolyline(last, 'first');
            } else if (last.attributes.Kategori == "Förgrening") {
                nextPolyline = findNextPolyline(last, 'first');

                total2 = calculateTotalPressure(
                    last.capacity,
                    nextPolyline.dimension.inner,
                    nextPolyline.length,
                    nextPolyline.tilt
                );

                combinedPressure = parseFloat(total) + parseFloat(total2);
                combinedPressure = parseFloat(combinedPressure.toFixed(2));

                //olika dimensioner??
                getResults(first, pumps, combinedPressure, dimension);
            } else {
                getResults(first, pumps, total, dimension);
                last.capacity = first.capacity;
            }
            break;
        default:
            getResults(first, pumps, total, dimension);
    }
};

/**
 * getResults - Checks values against the pump curve by using the checkPump function
 *
 * @param {L.Marker} first     The marker that have the pump inside it
 * @param {object}   pumps     All the pumps that the database have
 * @param {float} 	 total     total pressure that are calculated beforehand
 * @param {string} 	 dimension Inner dimension of the selected pipe
 *
 * @returns {void}
 */
let getResults = (first, pumps, total, dimension) => {
    let result = {};
    let pump = pumps.find(element =>
        element.Modell == first.attributes.Pump);

    result.calculations = checkPump(pump, total, parseFloat(dimension));
    result.totalPressure = total;
    show.alert(first, result);
};

/**
 * checkPump - Recommends pumps according to calculations.
 *
 * @param {object} pump     Selected pump to examine
 * @param {number} pressure total pressure from previous calculations
 * @param {number} dim 		Inner dimension of the selected pipe
 *
 * @returns {void}
 */
let checkPump = (pump, pressure, dim) => {
    let found = false;
    let mps = 0;
    let result = {};

    for (let i = 0; i < pump.Pumpkurva.length; i++) {
        if (pump.Pumpkurva[i].y == pressure) {
            mps = calculations.calcVelocity(pump.Pumpkurva[i].x, dim);
            mps /= 1000;
            result.mps = mps;
            if (mps >= 0.6 && mps <= 3) {
                result.status = 0;
                found = true;
                break;
            } else if (mps < 0.6) {
                result.status = 1;
                break;
            } else if (mps > 3) {
                result.status = 2;
                break;
            }
        }
    }
    if (!found) {
        if (pressure < pump.Pumpkurva[0].y && pressure >
            pump.Pumpkurva[pump.Pumpkurva.length - 1].y) {
            mps = calculations.calcVelocity(calculations.estPumpValue(pressure,
                pump.Pumpkurva), dim);
            mps /= 1000;
            result.mps = mps;
            if (mps >= 0.6 && mps <= 3) {
                result.status = 0;
                found = true;
            } else if (mps < 0.6) {
                result.status = 1;
            } else if (mps > 3) {
                result.status = 2;
            }
        } else if (pressure > pump.Pumpkurva[0].y) {
            mps = calculations.calcVelocity(calculations.estPumpValue(pressure,
                pump.Pumpkurva), dim);
            mps /= 1000;
            result.mps = mps;
            result.status = 3;
        } else if (pressure < pump.Pumpkurva[pump.Pumpkurva.length - 1].y) {
            mps = calculations.calcVelocity(calculations.estPumpValue(pressure,
                pump.Pumpkurva), dim);
            mps /= 1000;
            result.mps = mps;
            result.status = 4;
        }
        found = false;
    }
    return result;
};
