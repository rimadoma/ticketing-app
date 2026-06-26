import mongoose from 'mongoose';
import { prop, getModelForClass, modelOptions } from '@typegoose/typegoose';
import { AppError, AppErrorIds } from '@mahonen_consulting_zlc/common';
import { OrderModel, OrderStatus } from './order.js';

@modelOptions({ schemaOptions: { _id: false } })
class Price {
    @prop({ type: () => mongoose.Types.Decimal128, required: true })
    public amount!: mongoose.Types.Decimal128;

    @prop({ type: () => String, required: true, default: 'EUR' })
    public currency!: string;
}

@modelOptions({
    schemaOptions: {
        toJSON: {
            transform(_doc, ret) {
                return {
                    id: ret._id.toString(),
                    title: ret.title,
                    price: {
                        amount: ret.price.amount.toString(),
                        currency: ret.price.currency,
                    },
                    version: ret.version,
                };
            }
        }
    }
})
export class Ticket {
    @prop({ type: () => String, required: true })
    public title!: string;

    @prop({ type: () => Price, required: true, _id: false })
    public price!: Price;

    @prop({ type: () => mongoose.Schema.Types.Int32, required: true })
    public version!: number;

    public async isReserved(): Promise<boolean> {
        let existingOrder;
        try {
            existingOrder = await OrderModel.findOne({ ticket: this, status: { $ne: OrderStatus.Cancelled } });
        } catch (err) {
            throw new AppError(err, AppErrorIds.DB_READ_ERROR);
        }
        return existingOrder !== null;
    }
}

export const TicketModel = getModelForClass(Ticket);
