import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Category name is required"],
            trim: true,
            unique: true,
            index: true
        },
        description: {
            type: String,
            trim: true
        },
        parentCategory: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            default: null
        },
        slug: {
            type: String,
            lowercase: true,
            unique: true
        },
        image: {
            type: String
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
    },
    { timestamps: true }
);

// Generate slug from name before saving
categorySchema.pre("save", function(next) {
    if (!this.isModified("name")) return next();
    this.slug = this.name
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    next();
});

// Update slug when name is updated
categorySchema.pre("findOneAndUpdate", async function(next) {
    const update = this.getUpdate();
    if (update.name) {
        update.slug = update.name
            .toLowerCase()
            .replace(/[^a-zA-Z0-9]/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");
    }
    next();
});

// Update ancestors array when parent changes
categorySchema.pre('save', async function(next) {
    if (this.isModified('parentCategory')) {
        this.ancestors = [];
        if (this.parentCategory) {
            try {
                const parent = await mongoose.model('Category').findById(this.parentCategory);
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
    return await mongoose.model('Category').find({ parentCategory: this._id });
};

export const Category = mongoose.model("Category", categorySchema); 

