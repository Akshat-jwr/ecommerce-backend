import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    description: {
        type: String,
        default: ""
    },
    image: {
        type: String,
        default: ""
    },
    parent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        default: null
    },
    ancestors: [{
        _id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category"
        },
        name: String,
        slug: String
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    displayOrder: {
        type: Number,
        default: 0
    },
    featuredProducts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product"
    }],
    metadata: {
        seoTitle: String,
        seoDescription: String,
        seoKeywords: [String]
    }
}, { timestamps: true });

// Create slug from name before saving
categorySchema.pre('save', function(next) {
    if (this.isModified('name')) {
        this.slug = this.name.toLowerCase()
            .replace(/[^\w\s-]/g, '') // Remove non-word chars
            .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
            .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
    }
    next();
});

// Update ancestors array when parent changes
categorySchema.pre('save', async function(next) {
    if (this.isModified('parent')) {
        this.ancestors = [];
        if (this.parent) {
            try {
                const parent = await mongoose.model('Category').findById(this.parent);
                if (parent) {
                    this.ancestors = [
                        ...parent.ancestors,
                        {
                            _id: parent._id,
                            name: parent.name,
                            slug: parent.slug
                        }
                    ];
                }
            } catch (err) {
                console.error('Error updating category ancestors:', err);
            }
        }
    }
    next();
});

// Method to get full category path
categorySchema.methods.getPath = function() {
    return this.ancestors.map(a => a.name).concat(this.name).join(' > ');
};

// Method to get all child categories
categorySchema.methods.getChildren = async function() {
    return await mongoose.model('Category').find({ parent: this._id });
};

export const Category = mongoose.model("Category", categorySchema); 

