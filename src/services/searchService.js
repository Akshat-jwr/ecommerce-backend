import { Client } from '@elastic/elasticsearch';
import logger from '../utils/logger.js';

class SearchService {
  constructor() {
    this.client = new Client({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
      auth: process.env.ELASTICSEARCH_AUTH ? {
        username: process.env.ELASTICSEARCH_USERNAME,
        password: process.env.ELASTICSEARCH_PASSWORD
      } : undefined,
      maxRetries: 3,
      requestTimeout: 60000,
      sniffOnStart: true
    });

    this.productIndex = 'products';
    this.categoryIndex = 'categories';
    
    this.initializeIndices();
  }

  async initializeIndices() {
    try {
      // Create product index if it doesn't exist
      const productExists = await this.client.indices.exists({
        index: this.productIndex
      });

      if (!productExists.body) {
        await this.createProductIndex();
      }

      // Create category index if it doesn't exist
      const categoryExists = await this.client.indices.exists({
        index: this.categoryIndex
      });

      if (!categoryExists.body) {
        await this.createCategoryIndex();
      }

      logger.info('Elasticsearch indices initialized successfully');
    } catch (error) {
      logger.error('Error initializing Elasticsearch indices:', error);
    }
  }

  async createProductIndex() {
    const mapping = {
      mappings: {
        properties: {
          name: {
            type: 'text',
            analyzer: 'standard',
            fields: {
              keyword: { type: 'keyword' },
              suggest: {
                type: 'completion',
                analyzer: 'simple'
              }
            }
          },
          description: {
            type: 'text',
            analyzer: 'standard'
          },
          shortDescription: {
            type: 'text'
          },
          price: {
            type: 'float'
          },
          category: {
            type: 'keyword'
          },
          categoryName: {
            type: 'text',
            fields: {
              keyword: { type: 'keyword' }
            }
          },
          brand: {
            type: 'keyword'
          },
          tags: {
            type: 'keyword'
          },
          status: {
            type: 'keyword'
          },
          stock: {
            type: 'integer'
          },
          averageRating: {
            type: 'float'
          },
          reviewCount: {
            type: 'integer'
          },
          isFeatured: {
            type: 'boolean'
          },
          isDigital: {
            type: 'boolean'
          },
          images: {
            type: 'nested',
            properties: {
              url: { type: 'keyword' },
              isFeatured: { type: 'boolean' },
              alt: { type: 'text' }
            }
          },
          variants: {
            type: 'nested',
            properties: {
              name: { type: 'text' },
              sku: { type: 'keyword' },
              price: { type: 'float' },
              stock: { type: 'integer' },
              attributes: {
                properties: {
                  color: { type: 'keyword' },
                  size: { type: 'keyword' },
                  weight: { type: 'float' }
                }
              }
            }
          },
          discounts: {
            type: 'nested',
            properties: {
              type: { type: 'keyword' },
              value: { type: 'float' },
              isActive: { type: 'boolean' },
              startDate: { type: 'date' },
              endDate: { type: 'date' }
            }
          },
          specifications: {
            type: 'object',
            dynamic: true
          },
          features: {
            type: 'text'
          },
          seo: {
            properties: {
              keywords: { type: 'text' },
              metaTitle: { type: 'text' },
              metaDescription: { type: 'text' }
            }
          },
          analytics: {
            properties: {
              viewCount: { type: 'integer' },
              totalSales: { type: 'integer' },
              conversionRate: { type: 'float' }
            }
          },
          createdAt: {
            type: 'date'
          },
          updatedAt: {
            type: 'date'
          },
          // Boost fields for relevance scoring
          boost_name: {
            type: 'text',
            boost: 3.0
          },
          boost_brand: {
            type: 'text',
            boost: 2.0
          }
        }
      },
      settings: {
        analysis: {
          analyzer: {
            product_analyzer: {
              type: 'custom',
              tokenizer: 'standard',
              filter: [
                'lowercase',
                'stop',
                'snowball',
                'synonym_filter'
              ]
            }
          },
          filter: {
            synonym_filter: {
              type: 'synonym',
              synonyms: [
                'smartphone,mobile,phone',
                'laptop,computer,pc',
                'tv,television'
              ]
            }
          }
        },
        number_of_shards: 1,
        number_of_replicas: 1
      }
    };

    await this.client.indices.create({
      index: this.productIndex,
      body: mapping
    });

    logger.info('Product index created successfully');
  }

  async createCategoryIndex() {
    const mapping = {
      mappings: {
        properties: {
          name: {
            type: 'text',
            fields: {
              keyword: { type: 'keyword' },
              suggest: {
                type: 'completion'
              }
            }
          },
          description: {
            type: 'text'
          },
          parentCategory: {
            type: 'keyword'
          },
          level: {
            type: 'integer'
          },
          productCount: {
            type: 'integer'
          },
          createdAt: {
            type: 'date'
          }
        }
      }
    };

    await this.client.indices.create({
      index: this.categoryIndex,
      body: mapping
    });

    logger.info('Category index created successfully');
  }

  /**
   * Index a product
   */
  async indexProduct(product) {
    try {
      const doc = {
        name: product.name,
        description: product.description,
        shortDescription: product.shortDescription,
        price: product.price,
        category: product.category.toString(),
        categoryName: product.category?.name || '',
        brand: product.brand,
        tags: product.tags || [],
        status: product.status,
        stock: product.stock,
        averageRating: product.averageRating || 0,
        reviewCount: product.reviewCount || 0,
        isFeatured: product.isFeatured || false,
        isDigital: product.isDigital || false,
        images: product.images || [],
        variants: product.variants || [],
        discounts: product.discounts || [],
        specifications: product.specifications || {},
        features: product.features || [],
        seo: product.seo || {},
        analytics: {
          viewCount: product.viewCount || 0,
          totalSales: product.analytics?.totalSales || 0,
          conversionRate: product.analytics?.conversionRate || 0
        },
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
        // Boost fields
        boost_name: product.name,
        boost_brand: product.brand
      };

      await this.client.index({
        index: this.productIndex,
        id: product._id.toString(),
        body: doc
      });

      logger.debug(`Product ${product._id} indexed successfully`);
    } catch (error) {
      logger.error(`Error indexing product ${product._id}:`, error);
    }
  }

  /**
   * Update product in index
   */
  async updateProduct(product) {
    await this.indexProduct(product);
  }

  /**
   * Remove product from index
   */
  async removeProduct(productId) {
    try {
      await this.client.delete({
        index: this.productIndex,
        id: productId.toString()
      });

      logger.debug(`Product ${productId} removed from index`);
    } catch (error) {
      if (error.meta?.statusCode !== 404) {
        logger.error(`Error removing product ${productId} from index:`, error);
      }
    }
  }

  /**
   * Advanced product search
   */
  async searchProducts(query, filters = {}, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        sort = 'relevance',
        order = 'desc'
      } = options;

      const from = (page - 1) * limit;

      // Build search query
      const searchQuery = {
        bool: {
          must: [],
          filter: [],
          should: [],
          minimum_should_match: 0
        }
      };

      // Add text search
      if (query && query.trim()) {
        searchQuery.bool.must.push({
          multi_match: {
            query: query,
            fields: [
              'name^3',
              'boost_name^5',
              'brand^2',
              'boost_brand^3',
              'description',
              'tags^2',
              'features',
              'seo.keywords^2'
            ],
            type: 'best_fields',
            fuzziness: 'AUTO',
            prefix_length: 2
          }
        });

        // Add phrase matching for exact matches
        searchQuery.bool.should.push({
          multi_match: {
            query: query,
            fields: ['name^5', 'brand^3'],
            type: 'phrase',
            boost: 2.0
          }
        });
      } else {
        // Match all if no query
        searchQuery.bool.must.push({
          match_all: {}
        });
      }

      // Apply filters
      if (filters.category) {
        searchQuery.bool.filter.push({
          term: { category: filters.category }
        });
      }

      if (filters.brand) {
        searchQuery.bool.filter.push({
          term: { brand: filters.brand }
        });
      }

      if (filters.tags && filters.tags.length > 0) {
        searchQuery.bool.filter.push({
          terms: { tags: filters.tags }
        });
      }

      if (filters.minPrice || filters.maxPrice) {
        const priceRange = {};
        if (filters.minPrice) priceRange.gte = filters.minPrice;
        if (filters.maxPrice) priceRange.lte = filters.maxPrice;
        
        searchQuery.bool.filter.push({
          range: { price: priceRange }
        });
      }

      if (filters.inStock) {
        searchQuery.bool.filter.push({
          range: { stock: { gt: 0 } }
        });
      }

      if (filters.isFeatured !== undefined) {
        searchQuery.bool.filter.push({
          term: { isFeatured: filters.isFeatured }
        });
      }

      if (filters.status) {
        searchQuery.bool.filter.push({
          term: { status: filters.status }
        });
      }

      // Add rating boost
      searchQuery.bool.should.push({
        function_score: {
          query: { match_all: {} },
          boost: 1.2,
          functions: [
            {
              field_value_factor: {
                field: 'averageRating',
                factor: 0.1,
                modifier: 'ln1p',
                missing: 0
              }
            }
          ]
        }
      });

      // Build sort
      let sortArray = [];
      
      if (sort === 'relevance' && query) {
        sortArray.push({ _score: { order: 'desc' } });
      } else {
        switch (sort) {
          case 'price':
            sortArray.push({ price: { order } });
            break;
          case 'rating':
            sortArray.push({ averageRating: { order } });
            break;
          case 'popularity':
            sortArray.push({ 'analytics.viewCount': { order } });
            break;
          case 'newest':
            sortArray.push({ createdAt: { order } });
            break;
          default:
            sortArray.push({ _score: { order: 'desc' } });
        }
      }

      // Execute search
      const result = await this.client.search({
        index: this.productIndex,
        body: {
          query: searchQuery,
          sort: sortArray,
          from,
          size: limit,
          highlight: {
            fields: {
              name: {},
              description: {},
              features: {}
            }
          },
          aggs: {
            categories: {
              terms: { field: 'category', size: 20 }
            },
            brands: {
              terms: { field: 'brand', size: 20 }
            },
            price_ranges: {
              range: {
                field: 'price',
                ranges: [
                  { to: 100 },
                  { from: 100, to: 500 },
                  { from: 500, to: 1000 },
                  { from: 1000, to: 5000 },
                  { from: 5000 }
                ]
              }
            },
            avg_price: {
              avg: { field: 'price' }
            }
          }
        }
      });

      const hits = result.body.hits;
      const aggregations = result.body.aggregations;

      return {
        products: hits.hits.map(hit => ({
          ...hit._source,
          _id: hit._id,
          _score: hit._score,
          highlights: hit.highlight
        })),
        total: hits.total.value,
        page,
        limit,
        pages: Math.ceil(hits.total.value / limit),
        aggregations: {
          categories: aggregations.categories.buckets,
          brands: aggregations.brands.buckets,
          priceRanges: aggregations.price_ranges.buckets,
          averagePrice: aggregations.avg_price.value
        }
      };
    } catch (error) {
      logger.error('Error searching products:', error);
      throw error;
    }
  }

  /**
   * Get search suggestions
   */
  async getSuggestions(query, limit = 10) {
    try {
      const result = await this.client.search({
        index: this.productIndex,
        body: {
          suggest: {
            product_suggest: {
              prefix: query,
              completion: {
                field: 'name.suggest',
                size: limit
              }
            }
          }
        }
      });

      return result.body.suggest.product_suggest[0].options.map(option => ({
        text: option.text,
        score: option._score
      }));
    } catch (error) {
      logger.error('Error getting suggestions:', error);
      return [];
    }
  }

  /**
   * Get popular search terms
   */
  async getPopularSearchTerms(limit = 10) {
    try {
      const result = await this.client.search({
        index: 'search_logs', // Assuming you log searches
        body: {
          size: 0,
          aggs: {
            popular_terms: {
              terms: {
                field: 'query.keyword',
                size: limit
              }
            }
          }
        }
      });

      return result.body.aggregations.popular_terms.buckets.map(bucket => ({
        term: bucket.key,
        count: bucket.doc_count
      }));
    } catch (error) {
      logger.error('Error getting popular search terms:', error);
      return [];
    }
  }

  /**
   * Bulk index products
   */
  async bulkIndexProducts(products) {
    try {
      const body = [];

      products.forEach(product => {
        body.push({
          index: {
            _index: this.productIndex,
            _id: product._id.toString()
          }
        });

        body.push({
          name: product.name,
          description: product.description,
          price: product.price,
          category: product.category.toString(),
          brand: product.brand,
          tags: product.tags || [],
          status: product.status,
          stock: product.stock,
          averageRating: product.averageRating || 0,
          isFeatured: product.isFeatured || false,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt
        });
      });

      const result = await this.client.bulk({ body });

      if (result.body.errors) {
        logger.error('Bulk indexing errors:', result.body.items.filter(item => item.index.error));
      }

      logger.info(`Bulk indexed ${products.length} products`);
      return result;
    } catch (error) {
      logger.error('Error bulk indexing products:', error);
      throw error;
    }
  }

  /**
   * Reindex all products
   */
  async reindexAllProducts() {
    try {
      logger.info('Starting product reindexing...');
      
      // Import Product model dynamically to avoid circular imports
      const { Product } = await import('../models/product.model.js');
      
      // Get all products in batches
      const batchSize = 100;
      let skip = 0;
      let totalProcessed = 0;

      while (true) {
        const products = await Product.find({})
          .populate('category', 'name')
          .skip(skip)
          .limit(batchSize)
          .lean();

        if (products.length === 0) break;

        await this.bulkIndexProducts(products);
        
        totalProcessed += products.length;
        skip += batchSize;
        
        logger.info(`Reindexed ${totalProcessed} products so far...`);
      }

      logger.info(`Reindexing completed. Total products processed: ${totalProcessed}`);
    } catch (error) {
      logger.error('Error reindexing products:', error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const health = await this.client.cluster.health();
      return {
        status: health.body.status,
        connected: true,
        indices: health.body.number_of_data_nodes
      };
    } catch (error) {
      return {
        status: 'red',
        connected: false,
        error: error.message
      };
    }
  }
}

// Create singleton instance
const searchService = new SearchService();

export { searchService as SearchService };
export default searchService;
