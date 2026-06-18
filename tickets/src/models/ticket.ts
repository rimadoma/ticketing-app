import { prop, getModelForClass, modelOptions } from '@typegoose/typegoose';

@modelOptions({
    schemaOptions: {
        toJSON: {
            transform(_doc, ret) {
                return { id: ret._id.toString(), title: ret.title, price: ret.price, userId: ret.userId };
            }
        }
    }
})
export class Ticket {
    @prop({ type: () => String, required: true })
    public title!: string;

    @prop({ type: () => String, required: true })
    public price!: string;

    @prop({ type: () => String, required: true })
    public userId!: string;
}

export const TicketModel = getModelForClass(Ticket);
