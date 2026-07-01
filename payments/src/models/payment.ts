import mongoose from 'mongoose';
import { prop, getModelForClass, modelOptions, type Ref } from '@typegoose/typegoose';
import { Order } from './order.js';

@modelOptions({
    schemaOptions: {
        versionKey: false,
        toJSON: {
            transform(_doc, ret) {
                return {
                    id: ret._id,
                    orderId: ret.orderId,
                    version: ret.version,
                };
            },
        },
    },
})
export class Payment {
    @prop({ type: () => String, required: true })
    public _id!: string;

    @prop({ ref: () => Order, required: true })
    public orderId!: Ref<Order>;

    @prop({ type: () => mongoose.Schema.Types.Int32, required: true })
    public version!: number;
}

export const PaymentModel = getModelForClass(Payment);
