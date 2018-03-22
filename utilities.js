
/**
 * Create unique records ID
 * @return {string} unique record ID
 */
var getUniqueID = function(){
    var identifiant ='_' + Math.random().toString(36).substr(2, 9);
    return identifiant;
};

/**
 * Gets the href value in an anchor element.
 * Skype transforms raw urls to html. Here we extract the href value from the url
 * @param {string} input Anchor Tag
 * @return {string} Url matched or null
 */
function parseAnchorTag(input) {
    var match = input.match('^<a href=\"([^\"]*)\">[^<]*</a>$');
    if (match && match[1]) {
        return match[1];
    }

    return null;
}

module.exports = {
    getUniqueID: getUniqueID,
    parseAnchorTag: parseAnchorTag
}