// The exported functions in this module makes a call to Microsoft Cognitive Service Computer Vision API and return caption
// description if found. Note: you can do more advanced functionalities like checking
// the confidence score of the caption. For more info checkout the API documentation:
// https://www.microsoft.com/cognitive-services/en-us/Computer-Vision-API/documentation/AnalyzeImage

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
    console.log(body);
    if (body) {
        var analysis = {
            "flagTrash":"",
            "trashType":"",
            "volume":""
        };
        var data = JSON.parse(body);
        console.log("I'm analyzing the body");
        
        for(i=0; i<data.Predictions.length;i++){
            if(data.Predictions[i].Probability>0.90){
                if(data.Predictions[i].Tag=="trash"){analysis.flagTrash="Yes"};
                if(data.Predictions[i].Tag=="recycable"){analysis.flagTrash="recycable"}; 
                if(data.Predictions[i].Tag=="household"){analysis.flagTrash="household"}; 
                if(data.Predictions[i].Tag=="50L"){analysis.volume="50L"};   
            };
        }
        console.log(analysis);
        return analysis;
    }
    return null;
}