import mongoose from 'mongoose';
import { prop, getModelForClass, modelOptions } from '@typegoose/typegoose';

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
                    userId: ret.userId,
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

    @prop({ type: () => String, required: true })
    public userId!: string;
}

export const TicketModel = getModelForClass(Ticket);
