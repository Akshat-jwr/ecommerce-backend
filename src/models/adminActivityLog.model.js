import mongoose from "mongoose";

const adminActivityLogSchema = new mongoose.Schema({
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    action: {
        type: String,
        required: true,
        enum: ["create", "update", "delete", "view", "export", "login", "logout", "other"]
    },
    target: {
        type: String,
        required: true,
        enum: ["product", "order", "user", "coupon", "review", "setting", "other"]
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false
    },
    description: {
        type: String,
        required: true
    },
    ipAddress: String,
    userAgent: String,
    changes: {
        before: Object,
        after: Object
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

// Static method to create a log entry
adminActivityLogSchema.statics.createLog = async function(logData) {
    try {
        return await this.create(logData);
    } catch (error) {
        console.error("Error creating admin activity log:", error);
        return null;
    }
};

// Method to format log for display
adminActivityLogSchema.methods.formatForDisplay = function() {
    return {
        id: this._id,
        admin: this.adminId,
        action: this.action.charAt(0).toUpperCase() + this.action.slice(1),
        target: this.target.charAt(0).toUpperCase() + this.target.slice(1),
        description: this.description,
        timestamp: this.timestamp.toLocaleString()
    };
};

export const AdminActivityLog = mongoose.model("AdminActivityLog", adminActivityLogSchema); 