const mongoose = require('mongoose');

const MetricsSchema = new mongoose.Schema({
    scenario: String,
    timestamp: { type: Date, default: Date.now },
    avgWaitTime: Number,
    avgTravelTime: Number,
    maxWaitTime: Number,
    elevatorUtilization: Number,
    requestsHandled: Number
});

module.exports = mongoose.model('Metrics', MetricsSchema);