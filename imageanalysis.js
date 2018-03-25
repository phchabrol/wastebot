// The exported functions in this module makes a call to Microsoft Custom Vision API and return caption
// description if found.

var request = require('request').defaults({ encoding: null });

/**
 *  Gets the caption of the image from an image stream
 * @param {stream} stream The stream to an image.
 * @return {Promise} Promise with caption string if succeeded, error otherwise
 */
exports.getCaptionFromStream = function (stream) {
    var apiUrl = process.env.MICROSOFT_CUSTOM_VISION_API_ENDPOINT;
    return new Promise(
        function (resolve, reject) {
            var requestData = {
                url: apiUrl,
                encoding: 'binary',
                json: true,
                headers: {
                    'Prediction-Key': process.env.MICROSOFT_CUSTOM_VISION_API_KEY,
                    'content-type': 'application/octet-stream'
                }
            };

            stream.pipe(request.post(requestData, function (error, response, body) {
                if (error) {
                    reject(error);
                } else if (response.statusCode !== 200) {
                    reject(body);
                } else {
                    resolve(extractCaption(body));
                }
            }));
        }
    );
};

/**
 * Gets the caption of the image from an image URL
 * @param {string} url The URL to an image.
 * @return {Promise} Promise with caption string if succeeded, error otherwise
 */
exports.getCaptionFromUrl = function (url) {
    var apiUrl = process.env.MICROSOFT_CUSTOM_VISION_API_ENDPOINT
    return new Promise(
        function (resolve, reject) {
            var requestData = {
                url: apiUrl,
                json: { 'url': url },
                headers: {
                    'Prediction-Key': process.env.MICROSOFT_CUSTOM_VISION_API_KEY,
                    'content-type': 'application/json'
                }
            };

            request.post(requestData, function (error, response, body) {
                if (error) {
                    reject(error);
                }
                else if (response.statusCode !== 200) {
                    reject(body);
                }
                else {
                    resolve(extractCaption(body));
                }
            });
        }
    );
};

/**
 * Extracts the caption description from the response of the Vision API
 * @param {Object} body Response of the Custom Vision API
 * @return {string} Description if caption found, null otherwise.
 */
function extractCaption(body) {
    if (body) {
        var analysis = {
            "flagTrash":"",
            "trashType":"",
            "volume":""
        };
        
        for(i=0; i<body.Predictions.length;i++){
            if(body.Predictions[i].Probability>0.90){
                if(body.Predictions[i].Tag=="trash"){analysis.flagTrash="Yes"};
                if(body.Predictions[i].Tag=="recyclable"){analysis.trashType="recyclable"}; 
                if(body.Predictions[i].Tag=="household"){analysis.trashType="household"}; 
                if(body.Predictions[i].Tag=="50L"){analysis.volume="50L"};
                if(body.Predictions[i].Tag=="380L"){analysis.volume="380L"};     
            };
        }
        return analysis;
    }
    return null;
}