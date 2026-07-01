import mongoose from 'mongoose';
import { prop, getModelForClass, modelOptions } from '@typegoose/typegoose';
import { OrderStatus } from '@mahonen_consulting_zlc/common';
export { OrderStatus };

class Price {
    @prop({ type: () => mongoose.Schema.Types.Decimal128, required: true })
    public amount!: mongoose.Types.Decimal128;

    @prop({ type: () => String, required: true })
    public currency!: string;
}

@modelOptions({
    schemaOptions: {
        versionKey: false,
        toJSON: {
            transform(_doc, ret) {
                return {
                    id: ret._id.toString(),
                    userId: ret.userId,
                    status: ret.status,
                    price: { amount: ret.price.amount.toString(), currency: ret.price.currency },
                    version: ret.version,
                };
            },
        },
    },
})
export class Order {
    @prop({ type: () => String, required: true })
    public userId!: string;

    @prop({ type: () => String, enum: OrderStatus, required: true })
    public status!: OrderStatus;

    @prop({ type: () => Price, required: true, _id: false })
    public price!: Price;

    @prop({ type: () => mongoose.Schema.Types.Int32, required: true })
    public version!: number;
}

export const OrderModel = getModelForClass(Order);
