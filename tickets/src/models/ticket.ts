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
        versionKey: false,
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

    @prop({ type: () => String, required: true })
    public userId!: string;

    @prop({ type: () => Number, required: true, default: 1 })
    public version!: number;
}

export const TicketModel = getModelForClass(Ticket);
