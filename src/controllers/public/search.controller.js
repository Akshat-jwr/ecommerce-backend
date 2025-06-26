// src/controllers/public/search.controller.js

import { Product } from "../../models/product.model.js";
import { Category } from "../../models/category.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import mongoose from "mongoose";
import natural from "natural";

// --- Advanced NLP Helper Functions ---

// A comprehensive synonym dictionary for a customized gift e-commerce store
const synonyms = {
  // --- Customization & Personalization Terms ---
  custom: ["personalized", "customised", "custom-made", "bespoke", "tailor-made", "made-to-order"],
  personalize: ["customize", "engrave", "monogram", "print", "add name", "add photo"],
  engraved: ["etched", "inscribed", "carved", "monogrammed"],
  printed: ["graphic", "design", "artwork", "photo print"],
  photo: ["picture", "image", "pic", "photograph", "snapshot"],
  name: ["initials", "monogram", "text", "word"],
  logo: ["brand", "emblem", "design"],
  message: ["quote", "saying", "text", "greeting"],
  design: ["artwork", "pattern", "graphic", "style", "motif"],

  // --- General Gift & Product Terms ---
  gift: ["present", "souvenir", "keepsake", "memento", "token", "goodie", "hamper"],
  item: ["product", "merchandise", "article", "piece"],
  accessory: ["trinket", "adornment", "gear"],
  set: ["bundle", "kit", "collection", "combo", "pack"],
  box: ["case", "container", "hamper", "package"],

  // --- Product Categories & Types ---
  mug: ["cup", "coffee cup", "tea cup", "stein"],
  tumbler: ["travel mug", "flask", "insulated cup", "sipper"],
  bottle: ["water bottle", "flask", "canteen"],
  glass: ["wine glass", "beer glass", "whiskey glass", "tumbler"],
  apparel: ["clothing", "wear", "outfit", "garment"],
  shirt: ["t-shirt", "tee", "top", "polo"],
  hoodie: ["sweatshirt", "jumper", "hooded top"],
  cap: ["hat", "beanie", "baseball cap", "snapback"],
  jewelry: ["jewellery", "ornament", "trinket"],
  necklace: ["pendant", "chain", "choker", "locket"],
  bracelet: ["bangle", "wristband", "charm bracelet"],
  ring: ["band"],
  earrings: ["studs", "drops", "hoops"],
  cushion: ["pillow", "throw pillow", "bolster"],
  frame: ["photo frame", "picture frame"],
  poster: ["print", "wall art", "art print", "canvas"],
  blanket: ["throw", "quilt", "comforter", "fleece"],
  keychain: ["keyring", "key fob", "key holder"],
  phonecase: ["phone case", "phone cover", "mobile case"],
  wallet: ["purse", "cardholder"],
  bag: ["tote", "handbag", "backpack", "satchel"],
  notebook: ["journal", "diary", "planner", "notepad"],
  calendar: ["planner", "agenda"],
  pen: ["stylus", "ballpoint"],
  coaster: ["drink mat", "cup holder"],
  album: ["photo album", "scrapbook", "memory book"],
  watch: ["timepiece", "chronograph", "smartwatch"],
  clock: ["wall clock", "desk clock", "alarm"],
  candle: ["scented candle", "jar candle"],
  teddy: ["teddy bear", "stuffed animal", "plush toy", "soft toy"],

  // --- Occasions ---
  birthday: ["bday", "birthdate", "bornday"],
  anniversary: ["jubilee", "celebration"],
  wedding: ["marriage", "nuptials", "bridal"],
  valentine: ["valentine's", "v-day", "love day"],
  christmas: ["xmas", "holidays", "yule", "festive"],
  mother: ["mom", "mommy", "mum", "mama"],
  father: ["dad", "daddy", "pop"],
  newborn: ["baby", "infant", "new baby", "baby shower"],
  graduation: ["grad", "convocation"],
  farewell: ["goodbye", "leaving"],

  // --- Recipient Terms ---
  couple: ["partners", "spouses", "boyfriend", "girlfriend", "husband", "wife"],
  him: ["men", "man", "male", "guy", "boyfriend", "husband", "dad", "father", "brother"],
  her: ["women", "woman", "female", "gal", "girlfriend", "wife", "mom", "mother", "sister"],
  friend: ["bestie", "buddy", "pal", "bff"],
  pet: ["dog", "cat", "animal"],

  // --- Materials ---
  wood: ["wooden", "bamboo"],
  metal: ["steel", "silver", "gold", "brass", "copper"],
  ceramic: ["porcelain", "pottery"],
  glass: ["crystal"],
  leather: ["faux leather", "vegan leather"],
  fabric: ["cotton", "polyester", "canvas", "fleece"],
};


// A comprehensive spellcheck corpus built from the synonyms and common misspellings
const spellcheckCorpus = [
  // Correct terms from synonyms (both keys and values)
  'custom', 'personalized', 'customised', 'bespoke', 'engraved', 'etched', 'inscribed',
  'printed', 'graphic', 'photo', 'picture', 'image', 'photograph', 'name', 'initials',
  'monogram', 'logo', 'design', 'gift', 'present', 'souvenir', 'keepsake', 'memento',
  'item', 'product', 'accessory', 'trinket', 'set', 'bundle', 'kit', 'collection', 'box',
  'mug', 'cup', 'stein', 'tumbler', 'flask', 'bottle', 'canteen', 'glass', 'apparel',
  'clothing', 'shirt', 't-shirt', 'tee', 'hoodie', 'sweatshirt', 'jumper', 'cap', 'hat',
  'beanie', 'jewelry', 'jewellery', 'ornament', 'necklace', 'pendant', 'chain', 'locket',
  'bracelet', 'bangle', 'ring', 'band', 'earrings', 'studs', 'cushion', 'pillow',
  'frame', 'poster', 'print', 'wall art', 'canvas', 'blanket', 'throw', 'quilt', 'keychain',
  'keyring', 'phonecase', 'phone cover', 'wallet', 'purse', 'cardholder', 'bag', 'tote',
  'notebook', 'journal', 'diary', 'planner', 'calendar', 'agenda', 'pen', 'coaster',
  'album', 'scrapbook', 'watch', 'timepiece', 'chronograph', 'clock', 'alarm', 'candle',
  'teddy', 'teddy bear', 'plush toy', 'birthday', 'bday', 'anniversary', 'wedding',
  'marriage', 'nuptials', 'valentine', 'christmas', 'xmas', 'holidays', 'mother', 'mom',
  'father', 'dad', 'newborn', 'baby', 'infant', 'graduation', 'grad', 'farewell', 'couple',
  'partners', 'boyfriend', 'girlfriend', 'husband', 'wife', 'him', 'men', 'her', 'women',
  'friend', 'bestie', 'pet', 'dog', 'cat', 'wood', 'wooden', 'metal', 'steel', 'silver',
  'gold', 'ceramic', 'leather', 'fabric', 'cotton', 'fleece',

  // --- Common Misspellings ---
  'personalize', 'personlized', 'customzed', 'persnolized', 'engravd', 'ingraved',
  'pictur', 'piture', 'photgraph', 'grafic', 'mesage', 'suvenir', 'kepsake', 'produckt',
  'accesory', 'colection', 'aparel', 'cloting', 'tshirt', 'shert', 'hodie', 'swetshirt',
  'jewelery', 'jewlery', 'jwellery', 'neckless', 'pendent', 'braclet', 'cushon', 'pilow',
  'pister', 'blnket', 'key-chain', 'key chain', 'phone case', 'walet', 'notbook', 'jurnal',
  'calender', 'calandar', 'albem', 'wotch', 'clok', 'alaram', 'candel', 'teddey',
  'brthday', 'aniversary', 'annversary', 'weddding', 'valantine', 'chrismas', 'cristmes',
  'frind', 'freind', 'boyfrind', 'girlfrind', 'husbend', 'woden', 'metalic', 'seramic',
  'lether', 'coton', 'fabrick'
];

const spellchecker = new natural.Spellcheck(spellcheckCorpus);

const processQuery = (query) => {
  const originalWords = query.toLowerCase().split(/\s+/);

  // Step 1: Correct spelling for each word
  const correctedWords = originalWords.map(word => {
    const corrections = spellchecker.getCorrections(word, 1);
    // If corrections are found, use the first one, otherwise keep the original word
    return corrections.length > 0 ? corrections[0] : word;
  });

  // Step 2: Expand the query with synonyms for each corrected word
  const expandedWords = correctedWords.flatMap(word => {
    // Return the word itself plus any of its synonyms
    return [word, ...(synonyms[word] || [])];
  });

  // Step 3: Create a unique set of words and build a regex OR pattern
  // E.g., for "watch", this becomes "watch|clock|timepiece"
  const uniqueWords = [...new Set(expandedWords)];
  const regexPattern = uniqueWords.join('|');

  // This pattern will match any of the words in the final list
  return regexPattern;
};


/**
 * @description Get autocomplete search suggestions for products and categories
 * @route GET /api/v1/public/search/suggestions
 */
export const getSearchSuggestions = asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.status(200).json(new ApiResponse(200, [], "Suggestions require a query."));
  }

  // Use the NLP-processed query for better suggestions
  const processedPattern = processQuery(q);
  const queryRegex = new RegExp(processedPattern, "i");

  // Get product suggestions (limit to 5)
  const productSuggestions = await Product.find({
    name: { $regex: queryRegex }
  })
  .select("name")
  .limit(5)
  .lean();

  // Get category suggestions (limit to 3)
  const categorySuggestions = await Category.find({
    name: { $regex: queryRegex }
  })
  .select("name")
  .limit(3)
  .lean();

  // Combine and format suggestions for a rich UI experience
  const suggestions = [
    ...productSuggestions.map(p => ({ type: "Product", name: p.name, value: p.name })),
    ...categorySuggestions.map(c => ({ type: "Category", name: c.name, value: c.name }))
  ];

  // Remove duplicates, prioritizing products
  const uniqueSuggestions = Array.from(new Map(suggestions.map(item => [item.name, item])).values());

  return res.status(200).json(
    new ApiResponse(200, uniqueSuggestions, "Search suggestions retrieved successfully")
  );
});


/**
 * @description Global search across products and categories with NLP
 * @route GET /api/v1/public/search
 */
export const globalSearch = asyncHandler(async (req, res) => {
  const { q, type = "all" } = req.query;

  // Process the query using advanced NLP helpers
  const processedPattern = processQuery(q);
  const queryRegex = new RegExp(processedPattern, "i");
  const searchResults = {};

  // Search products
  if (type === "all" || type === "products") {
    const productResults = await Product.find({
      $or: [
        { name: { $regex: queryRegex } },
        { description: { $regex: queryRegex } },
        { features: { $regex: queryRegex } }
      ]
    })
    .populate("category", "name")
    .select("name description price discountPercentage images stock averageRating")
    .limit(10)
    .lean();

    searchResults.products = productResults.map(product => ({
      ...product,
      discountedPrice: product.discountPercentage > 0
        ? product.price * (1 - product.discountPercentage / 100)
        : product.price,
      isInStock: product.stock > 0,
      featuredImage: product.images.find(img => img.isFeatured) || product.images[0],
      type: "product"
    }));
  }

  // Search categories
  if (type === "all" || type === "categories") {
    const categoryResults = await Category.aggregate([
      {
        $match: {
          $or: [
            { name: { $regex: queryRegex } },
            { description: { $regex: queryRegex } }
          ]
        }
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "category",
          as: "products"
        }
      },
      {
        $addFields: {
          productCount: { $size: "$products" },
          type: "category"
        }
      },
      { $project: { products: 0 } },
      { $limit: 5 }
    ]);
    searchResults.categories = categoryResults;
  }

  const totalResults = {
    products: searchResults.products?.length || 0,
    categories: searchResults.categories?.length || 0,
    total: (searchResults.products?.length || 0) + (searchResults.categories?.length || 0)
  };

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        ...searchResults,
        totalResults,
        searchQuery: q,
        processedPattern: processedPattern // For debugging/transparency
      },
      "Global search results retrieved successfully"
    )
  );
});


/**
 * @description Get available filter options for products
 * @route GET /api/v1/public/filters
 */
export const getFilterOptions = asyncHandler(async (req, res) => {
    const { category } = req.query;
    const baseFilter = category ? { category: new mongoose.Types.ObjectId(category) } : {};
    const priceStats = await Product.aggregate([ { $match: baseFilter }, { $group: { _id: null, minPrice: { $min: "$price" }, maxPrice: { $max: "$price" } } }]);
    const categories = await Category.aggregate([ { $lookup: { from: "products", localField: "_id", foreignField: "category", as: "products" } }, { $addFields: { productCount: { $size: "$products" } } }, { $match: { productCount: { $gt: 0 } } }, { $project: { name: 1, productCount: 1 } }, { $sort: { name: 1 } }]);
    const filterOptions = { priceRange: priceStats[0] || { minPrice: 0, maxPrice: 1000 } , categories };
    return res.status(200).json(new ApiResponse(200, filterOptions, "Filter options retrieved successfully"));
});
