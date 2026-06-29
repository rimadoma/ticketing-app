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
}

export const TicketModel = getModelForClass(Ticket);
