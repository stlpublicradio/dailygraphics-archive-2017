// Global config
var GEO_DATA_URL = 'data/geodata.json';


var LABEL_DEFAULTS = {
    'text-anchor': 'start',
    'dx': '10',
    'dy': '4'
}

var CITY_LABEL_ADJUSTMENTS = {
    'Makanda': { 'dx': 10, 'dy': -2 },
    'Goreville': {'dx': 10, 'dy': 2},
    'Point of Longest Eclipse': {'text-anchor': 'end', 'dx': -2, 'dy':13},
    'Madisonville': {'text-anchor': 'end', 'dy': -10},
    'Evansville': {'text-anchor': 'end', 'dy': -10}
}

var COUNTRY_LABEL_ADJUSTMENTS = {
    'Illinois': {'dy': 20},
    'Missouri': {'dx': 80, 'dy': 40}
}

// Global vars
var pymChild = null;
var isMobile = false;
var geoData = null;

/*
 * Initialize the graphic.
 */
var onWindowLoaded = function() {
    if (Modernizr.svg) {
        loadJSON()
    } else {
        pymChild = new pym.Child({});

    }
}

/*
 * Load graphic data from a CSV.
 */
var loadJSON = function() {
    d3.json(GEO_DATA_URL, function(error, data) {
        geoData = data;

        pymChild = new pym.Child({
            renderCallback: render
        });

        pymChild.onMessage('on-screen', function(bucket) {
            ANALYTICS.trackEvent('on-screen', bucket);
        });
        pymChild.onMessage('scroll-depth', function(data) {
            data = JSON.parse(data);
        ANALYTICS.trackEvent('scroll-depth', data.percent, data.seconds);
        });
    });
}

/*
 * Render the graphic(s). Called by pym with the container width.
 */
var render = function(containerWidth) {
    DEFAULT_WIDTH = 663;
    if (!containerWidth) {
        containerWidth = DEFAULT_WIDTH;
    }

    if (containerWidth <= MOBILE_THRESHOLD) {
        isMobile = true;
    } else {
        isMobile = false;
    }

    // Render the chart!
    renderLocatorMap({
        container: '#locator-map',
        width: containerWidth,
        data: geoData,
        primaryCountry: 'Illinois'
    });

    // Update iframe
    if (pymChild) {
        pymChild.sendHeight();
    }
}

var renderLocatorMap = function(config) {
    /*
     * Setup
     */
    var aspectWidth = 2;
    var aspectHeight = 1.2;

    var bbox = config['data']['bbox'];
    var defaultScale = 8000;
    var cityDotRadius = 3;

    // Calculate actual map dimensions
    var mapWidth = config['width'];
    var mapHeight = Math.ceil((config['width'] * aspectHeight) / aspectWidth);

    // Clear existing graphic (for redraw)
    var containerElement = d3.select(config['container']);
    containerElement.html('');

    var mapProjection = null;
    var path = null;
    var chartWrapper = null;
    var chartElement = null;

    /*
     * Extract topo data.
     */
    var mapData = {};

    for (var key in config['data']['objects']) {
        mapData[key] = topojson.feature(config['data'], config['data']['objects'][key]);
    }

    /*
     * Create the map projection.
     */
    var centroid = [((bbox[0] + bbox[2]) / 2), ((bbox[1] + bbox[3]) / 2)];
    var mapScale = (mapWidth / DEFAULT_WIDTH) * defaultScale;
    var scaleFactor = mapWidth / DEFAULT_WIDTH;

    projection = d3.geo.mercator()
        .center(centroid)
        .scale(mapScale)
        .translate([ mapWidth/2, mapHeight/2 ]);

    path = d3.geo.path()
        .projection(projection)
        .pointRadius(cityDotRadius * scaleFactor);

    /*
     * Create the root SVG element.
     */
    chartWrapper = containerElement.append('div')
        .attr('class', 'graphic-wrapper');

    chartElement = chartWrapper.append('svg')
        .attr('width', mapWidth)
        .attr('height', mapHeight)
        .append('g')

    /*
     * Create SVG filters.
     */
    var filters = chartElement.append('filters');

    var textFilter = filters.append('filter')
        .attr('id', 'textshadow');

    textFilter.append('feGaussianBlur')
        .attr('in', 'SourceGraphic')
        .attr('result', 'blurOut')
        .attr('stdDeviation', '.25');

    var landFilter = filters.append('filter')
        .attr('id', 'landshadow');

    landFilter.append('feGaussianBlur')
        .attr('in', 'SourceGraphic')
        .attr('result', 'blurOut')
        .attr('stdDeviation', '10');

    /*
     * Render countries.
     */
    // Land shadow
    chartElement.append('path')
        .attr('class', 'landmass')
        .datum(mapData['countries'])
        .attr('filter', 'url(#landshadow)')
        .attr('d', path);

    // Land outlines
    chartElement.append('g')
        .attr('class', 'countries')
        .selectAll('path')
            .data(mapData['countries']['features'])
        .enter().append('path')
            .attr('class', function(d) {
                return classify(d['id']);
            })
            .attr('d', path);

    // Highlight primary country
    var primaryCountryClass = classify(config['primaryCountry']);

    d3.select('.countries path.' + primaryCountryClass)
        .moveToFront()
        .classed('primary ' + primaryCountryClass, true);

    /*
     * Render rivers.
     */
    chartElement.append('g')
        .attr('class', 'rivers')
        .selectAll('path')
            .data(mapData['rivers']['features'])
        .enter().append('path')
            .attr('d', path);

    /*
     * Render lakes.
     */
    chartElement.append('g')
        .attr('class', 'lakes')
        .selectAll('path')
            .data(mapData['lakes']['features'])
        .enter().append('path')
            .attr('d', path);

    /*
     * Render roads.
     */
    chartElement.append('g')
        .attr('class', 'roads')
        .selectAll('path')
            .data(mapData['roads']['features'])
        .enter().append('path')
            .attr('d', path);

    /*
    *    Render eclipse path
    */

    chartElement.append('g')
        .attr('class', 'eclipsepath')
        .selectAll('path')
            .data(mapData['eclipsepath']['features'])
        .enter().append('path')
            .attr('d', path);

    /*
     * Render primary cities.
     */
    chartElement.append('g')
        .attr('class', 'cities primary')
        .selectAll('path')
            .data(mapData['cities']['features'])
        .enter().append('path')
            .attr('d', path)
            .attr('class', function(d) {
                var c = 'place';

                c += ' ' + classify(d['properties']['city']);
                c += ' ' + classify(d['properties']['featurecla']);
                c += ' scalerank-' + d['properties']['scalerank'];

                return c;
            });


    chartElement.append('g')
        .attr('class', 'cities eclipse')
        .selectAll('path')
            .data(mapData['collection']['features'])
        .enter().append('path')
            .attr('d', path)
            .attr('class', function(d) {
                var c = 'place';

                c += ' ' + classify(d['id']);

                return c;
            });

    /*
     * Render neighboring cities.
     */
    chartElement.append('g')
        .attr('class', 'cities neighbors')
        .selectAll('path')
            .data(mapData['neighbors']['features'])
        .enter().append('path')
            .attr('d', path)
            .attr('class', function(d) {
                var c = 'place';

                c += ' ' + classify(d['properties']['city']);
                c += ' ' + classify(d['properties']['featurecla']);
                c += ' scalerank-' + d['properties']['scalerank'];

                return c;
            });



    /*
     * Apply adjustments to label positioning.
     */
    var positionLabel = function(adjustments, id, attribute) {
        if (adjustments[id]) {
            if (adjustments[id][attribute]) {
                return adjustments[id][attribute];
            } else {
                return LABEL_DEFAULTS[attribute];
            }
        } else {
            return LABEL_DEFAULTS[attribute];
        }
    }

    /*
     * Render country labels.
     */
    chartElement.append('g')
        .attr('class', 'country-labels')
        .selectAll('.label')
            .data(mapData['countries']['features'])
        .enter().append('text')
            .attr('class', function(d) {
                return 'label ' + classify(d['id']);
            })
            .attr('transform', function(d) {
                return 'translate(' + path.centroid(d) + ')';
            })
            .attr('text-anchor', function(d) {
                return positionLabel(COUNTRY_LABEL_ADJUSTMENTS, d['id'], 'text-anchor');
            })
            .attr('dx', function(d) {
                return positionLabel(COUNTRY_LABEL_ADJUSTMENTS, d['id'], 'dx');
            })
            .attr('dy', function(d) {
                return positionLabel(COUNTRY_LABEL_ADJUSTMENTS, d['id'], 'dy');
            })
            .text(function(d) {
                return COUNTRIES[d['properties']['country']] || d['properties']['country'];
            });

    // Highlight primary country
    var primaryCountryClass = classify(config['primaryCountry']);

    d3.select('.country-labels text.' + primaryCountryClass)
        .classed('label primary ' + primaryCountryClass, true);

    /*
     * Render city labels.
     */
    var layers = [
        'city-labels shadow',
        'city-labels',
        'city-labels shadow primary',
        'city-labels primary'
    ];

    layers.forEach(function(layer) {
        var data = [];

        if (layer == 'city-labels shadow' || layer == 'city-labels') {
            data = mapData['neighbors']['features'];
        } else {
            data = mapData['cities']['features'];
        }

        chartElement.append('g')
            .attr('class', layer)
            .selectAll('.label')
                .data(data)
            .enter().append('text')
                .attr('class', function(d) {
                    var c = 'label';

                    c += ' ' + classify(d['properties']['city']);
                    c += ' ' + classify(d['properties']['featurecla']);
                    c += ' scalerank-' + d['properties']['scalerank'];

                    return c;
                })
                .attr('transform', function(d) {
                    return 'translate(' + projection(d['geometry']['coordinates']) + ')';
                })
                .attr('style', function(d) {
                    return 'text-anchor: ' + positionLabel(CITY_LABEL_ADJUSTMENTS, d['properties']['city'], 'text-anchor');
                })
                .attr('dx', function(d) {
                    return positionLabel(CITY_LABEL_ADJUSTMENTS, d['properties']['city'], 'dx');
                })
                .attr('dy', function(d) {
                    return positionLabel(CITY_LABEL_ADJUSTMENTS, d['properties']['city'], 'dy');
                })
                .text(function(d) {
                    return CITIES[d['properties']['city']] || d['properties']['city'];
                });
    });

    chartElement.append('g')
        .attr('class', 'city-labels eclipse')
        .selectAll('.label')
            .data(mapData['collection']['features'])
        .enter().append('text')
            .attr('class', function(d) {
                var c = 'label';

                c +=  ' ' + classify(d['id'])

                return c;
            })
            .attr('transform', function(d) {
                return 'translate(' + projection(d['geometry']['coordinates']) + ')';
            })
            .attr('style', function(d) {
                return 'text-anchor: ' + positionLabel(CITY_LABEL_ADJUSTMENTS, d['id'], 'text-anchor');
            })
            .attr('dx', function(d) {
                return positionLabel(CITY_LABEL_ADJUSTMENTS, d['id'], 'dx');
            })
            .attr('dy', function(d) {
                return positionLabel(CITY_LABEL_ADJUSTMENTS, d['id'], 'dy');
            })
            .text(function(d) {
                return CITIES[d['id']] || d['id'];
            });

    d3.selectAll('.shadow')
        .attr('filter', 'url(#textshadow)');

    /*
     * Render a scale bar.
     */
    var scaleBarDistance = calculateOptimalScaleBarDistance(bbox, 10);
    var scaleBarStart = [10, mapHeight - 20];
    var scaleBarEnd = calculateScaleBarEndPoint(projection, scaleBarStart, scaleBarDistance);

    chartElement.append('g')
        .attr('class', 'scale-bar')
        .append('line')
        .attr('x1', scaleBarStart[0])
        .attr('y1', scaleBarStart[1])
        .attr('x2', scaleBarEnd[0])
        .attr('y2', scaleBarEnd[1]);

    d3.select('.scale-bar')
        .append('text')
        .attr('x', scaleBarEnd[0] + 5)
        .attr('y', scaleBarEnd[1] + 3)
        .text(scaleBarDistance + ' miles');

        /*
         * Remove out-of-frame cities.
         */
         removals = ['.terre-haute','.new-albany','.hopkinsville','.poplar-bluff','.columbia','.jefferson-city','.bloomington','.bowling-green','.owensboro','.clarksville','.springfield','.louisville']

         removals.forEach(function(removal) {

             chartElement.selectAll(removal)
                .remove()
            });


    chartElement.append('g')
        .attr('class', 'totality-text')
        .append('text')
        .text('Path of totality')
        .attr('x', mapWidth * .1)
        .attr('y', mapHeight * .2)
        .attr('transform','rotate(29)')
}

/*
 * Move a set of D3 elements to the front of the canvas.
 */
d3.selection.prototype.moveToFront = function() {
    return this.each(function(){
        this.parentNode.appendChild(this);
    });
};

/*
 * Initially load the graphic
 * (NB: Use window.load to ensure all images have loaded)
 */
window.onload = onWindowLoaded;
