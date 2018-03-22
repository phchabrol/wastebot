var mongoose = require('mongoose');

var Schema = mongoose.Schema;

var TrashRecordSchema = new Schema(
  {
    record_date: {type: Date},
    user: {type: Schema.ObjectId, ref: 'User', required: true},
    trash_detected: {type: String, required: true},
    trash_type_detected: {type: String},
    volume_detected: {type: String}
  }
);

// Virtual for trash type detected
TrashRecordSchema
.virtual('trash_type')
.get(function () {
  return this.trash_type_detected;
});


// Virtual for record's URL
TrashRecordSchema
.virtual('url')
.get(function () {
  return '/records/' + this._id;
});


//Export model
module.exports = mongoose.model('TrashRecord', TrashRecordSchema);