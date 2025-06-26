import mongoose from 'mongoose';
import { User } from '../models/user.model.js';
import { Product } from '../models/product.model.js';
import { Order } from '../models/order.model.js';
import { ApiError } from '../utils/ApiError.js';
// Removed specific paymentService import as it's not provided yet.
// You need to replace this with your actual payment service.
// import paymentService from './paymentService.js'; 

class OrderService {
  static async createNewOrder({ userId, shippingAddressId, paymentMethod }) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const user = await User.findById(userId).session(session);
      if (!user || user.cart.items.length === 0) {
        throw new ApiError(404, "User not found or cart is empty");
      }

      const shippingAddress = user.addresses.id(shippingAddressId);
      if (!shippingAddress) {
        throw new ApiError(404, "Shipping address not found");
      }
      
      const productIds = user.cart.items.map(item => item.productId);
      // Fetch products and ensure virtuals are included for discountedPrice
      const products = await Product.find({ _id: { $in: productIds } }).session(session).lean({ virtuals: true });

      let subtotal = 0;
      const orderItems = [];
      
      for (const cartItem of user.cart.items) {
        const product = products.find(p => p._id.equals(cartItem.productId));
        if (!product || product.stock < cartItem.quantity) {
          throw new ApiError(400, `Product "${product?.name || cartItem.productId}" is out of stock.`);
        }
        
        // Use the virtual `discountedPrice`
        const price = product.discountedPrice;
        subtotal += price * cartItem.quantity;
        
        orderItems.push({
          product: product._id,
          quantity: cartItem.quantity,
          price: price,
        });

        // Update stock directly on the product model (not the lean object)
        const productToUpdate = await Product.findById(product._id).session(session);
        productToUpdate.stock -= cartItem.quantity;
        await productToUpdate.save({ session });
      }

      const tax = subtotal * 0.18; // Example: 18% GST
      const shipping = subtotal > 999 ? 0 : 99;
      const total = subtotal + tax + shipping;

      let paymentGatewayOrder = null;
      // You need to integrate your actual payment service here.
      // For now, it will just proceed without external payment gateway interaction.
      if (paymentMethod !== 'cod') {
        // paymentGatewayOrder = await paymentService.createRazorpayOrder(total);
        // Placeholder for real payment service integration
        console.log(`Payment via gateway for total: ${total} with method: ${paymentMethod}`);
        paymentGatewayOrder = { id: `MOCK_TXN_${Date.now()}` }; // Mock transaction ID
      }

      const newOrder = new Order({
        user: userId,
        items: orderItems,
        shippingAddress: shippingAddress.toObject(),
        subtotal,
        tax,
        shipping,
        total,
        paymentInfo: {
          method: paymentMethod,
          status: 'pending',
          gateway: paymentMethod !== 'cod' ? 'razorpay' : undefined, // Assuming Razorpay
          transactionId: paymentGatewayOrder?.id
        }
      });
      
      await newOrder.save({ session });
      
      user.cart.items = [];
      user.cart.totalPrice = 0;
      await user.save({ session });

      await session.commitTransaction();
      
      return { order: newOrder, paymentGatewayOrder };

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}

export default OrderService;
