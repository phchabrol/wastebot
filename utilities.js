
/**
 * Create unique records ID
 * @return {string} unique record ID
 */
// function used to 
var getUniqueID = function(){
    var identifiant ='_' + Math.random().toString(36).substr(2, 9);
    return identifiant;
};

module.exports = {
    getUniqueID: getUniqueID
}