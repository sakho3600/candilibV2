import mongoose from 'mongoose'

import { getDateTimeFrFromJSDate } from '../../util/date.util'

const { Schema } = mongoose
const ObjectId = Schema.Types.ObjectId

export const placeCommonFields = {
  inspecteur: {
    type: ObjectId,
    required: false,
    trim: true,
    ref: 'Inspecteur',
  },
  centre: {
    type: ObjectId, // ObjectId du centre pour la V2
    required: false,
    ref: 'Centre',
  },
  // dateTime
  date: {
    type: Date,
    required: false,
  },
}

const PlaceSchema = new Schema({
  ...placeCommonFields,
  candidat: {
    type: ObjectId, // ObjectId du candidat ayant réservé cette place
    required: false,
    ref: 'Candidat',
  },
})

PlaceSchema.index({ date: 1, inspecteur: 1 }, { unique: true })

PlaceSchema.pre('save', async function preSave () {
  const place = this
  const model = mongoose.model('Place')
  // Rechercher les places de cet inspecteur à cette date
  const places = await model.find({
    inspecteur: place.inspecteur,
    date: {
      $gte: getDateTimeFrFromJSDate(place.date).startOf('day').toJSDate(),
      $lt: getDateTimeFrFromJSDate(place.date).endOf('day').toJSDate(),
    },
  }).populate('inspecteur')

  if (places.length) {
    if (places.some(currentPlace => currentPlace.centre !== place.centre)) {
      throw new Error(`Incohérence dans le planning: l'inspecteur ${place.inspecteur} est déjà dans un autre centre ce jour-là`)
    }
  }
})

const model = mongoose.model('Place', PlaceSchema)

export default model
