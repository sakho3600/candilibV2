import * as csvParser from 'fast-csv'
import { DateTime } from 'luxon'

import { addPlaceToArchive, setCandidatToVIP, addPlaceToArchive, setCandidatToVIP } from '../../models/candidat'
import { findCentreByNameAndDepartement, findCentreByNameAndDepartement } from '../../models/centre/centre.queries'
import {
  bookPlaceById,
  createPlace,
  deletePlace,
  findPlaceBookedByCandidat,
  findPlaceById,
  PLACE_ALREADY_IN_DB_ERROR,
  removeBookedPlace,
} from '../../models/place'

import { findInspecteurByMatricule } from '../../models/inspecteur/inspecteur.queries'
import { sendCancelBookingByAdmin } from '../business'
import { REASON_REMOVE_RESA_ADMIN } from '../../routes/common/reason.constants'
import { appLogger } from '../../util'
import { ErrorWithStatus } from '../../util/error.status'
import {
  RESA_BOOKED_CANCEL,
  RESA_BOOKED_CANCEL_NO_MAIL,
  DELETE_PLACE_ERROR,
  RESA_PLACE_HAS_BOOKED,
} from './message.constants'

const getPlaceStatus = (
  departement,
  centre,
  inspecteur,
  date,
  status,
  message
) => ({
  departement,
  centre,
  inspecteur,
  date,
  status,
  message,
})

/**
 * TODO:departement a modifier
 * @param {*} data
 */
const transfomCsv = async ({ data, departement }) => {
  const [day, time, inspecteur, centre, dept] = data

  const myDate = `${day.trim()} ${time.trim()}`

  try {
    const date = DateTime.fromFormat(myDate, 'dd/MM/yy HH:mm', {
      zone: 'Europe/Paris',
      locale: 'fr',
    })

    if (dept !== departement) {
      throw new Error(
        'Le département du centre ne correspond pas au département dont vous avez la charge'
      )
    }

    if (!date.isValid) throw new Error('Date est invalide')
    // TODO: create test unit for search centre by center name and departement
    const foundCentre = await findCentreByNameAndDepartement(
      centre.trim(),
      departement
    )
    if (!foundCentre) {
      throw new Error(`Le centre ${centre.trim()} est inconnu`)
    }

    const inspecteurFound = await findInspecteurByMatricule(inspecteur.trim())
    if (!inspecteurFound) {
      throw new Error(`L'inspecteur ${inspecteur.trim()} est inconnu`)
    }

    return {
      departement,
      centre: foundCentre,
      inspecteur: inspecteurFound._id,
      date,
    }
  } catch (error) {
    appLogger.error({
      section: 'admimImportPlaces',
      action: 'transformCsv',
      error,
    })
    return getPlaceStatus(
      departement,
      centre,
      inspecteur,
      myDate,
      'error',
      error.message
    )
  }
}

const createPlaceCsv = async place => {
  const { centre, inspecteur, date } = place
  try {
    const leanPlace = { inspecteur, date, centre: centre._id }
    await createPlace(leanPlace)
    appLogger.info({
      section: 'Admim-ImportPlaces',
      action: 'createPlaceCsv',
      message: `Place {${centre.departement},${
        centre.nom
      }, ${inspecteur}, ${date}} enregistrée en base`,
    })
    return getPlaceStatus(
      centre.departement,
      centre.nom,
      leanPlace.inspecteur,
      date,
      'success',
      `Place enregistrée en base`
    )
  } catch (error) {
    appLogger.error(JSON.stringify(error))
    if (error.message === PLACE_ALREADY_IN_DB_ERROR) {
      appLogger.warn({
        section: 'Admim-ImportPlaces',
        action: 'createPlaceCsv',
        message: 'Place déjà enregistrée en base',
      })
      return getPlaceStatus(
        centre.departement,
        centre.nom,
        inspecteur,
        date,
        'error',
        'Place déjà enregistrée en base'
      )
    }
    return getPlaceStatus(
      centre.departement,
      centre.nom,
      inspecteur,
      date,
      'error',
      error.message
    )
  }
}

export const importPlacesCsv = async ({ csvFile, departement }) => {
  let PlacesPromise = []

  if (!departement) {
    throw new Error('DEPARTEMENT_IS_MANDATORY')
  }

  return new Promise((resolve, reject) =>
    csvParser
      .fromString(csvFile.data.toString(), { headers: true, ignoreEmpty: true })
      .transform((data, next) => {
        try {
          if (data[0] === 'Date') next()
          else {
            transfomCsv({ data, departement }).then(result => {
              appLogger.debug('transfomCsv' + result)
              if (result.status && result.status === 'error') {
                PlacesPromise.push(result)
                next()
              } else {
                next(null, result)
              }
            })
          }
        } catch (error) {
          appLogger.error(JSON.stringify(error))
        }
      })
      .on('data', place => {
        PlacesPromise.push(createPlaceCsv(place))
      })
      .on('end', () => {
        resolve(Promise.all(PlacesPromise))
      })
  )
}

export const releaseResa = async ({ _id }) => {
  const place = await findPlaceBookedByCandidat(_id)
  if (place) {
    appLogger.info({
      section: 'admin',
      action: 'releaseResa',
      candidat: _id,
      place,
    })
    return removeBookedPlace(place)
  }
}

export const removeReservationPlaceByAdmin = async (place, candidat, admin) => {
  // Annuler la place
  const placeUpdated = await removeBookedPlace(place)
  // Archive place
  let candidatUpdated = addPlaceToArchive(
    candidat,
    place,
    REASON_REMOVE_RESA_ADMIN,
    admin.email
  )
  candidatUpdated = await setCandidatToVIP(candidatUpdated, place.date)

  let statusmail = true
  let message = RESA_BOOKED_CANCEL
  try {
    await sendCancelBookingByAdmin(placeUpdated, candidatUpdated)
  } catch (error) {
    appLogger.warn({
      section: 'candidat-removeReservations',
      action: 'FAILED_SEND_MAIL',
      error,
    })
    statusmail = false
    message = RESA_BOOKED_CANCEL_NO_MAIL
  }

  try {
    await deletePlace(placeUpdated)
  } catch (error) {
    appLogger.warn({
      section: 'admin-removePlace',
      action: 'FAILED_DELETE_PLACE',
      error,
    })
    message = DELETE_PLACE_ERROR
  }

  return { statusmail, message, candidat: candidatUpdated, placeUpdated }
}

export const createPlaceForInspector = async (centre, inspecteur, date) => {
  const myDate = date
  try {
    const formatedDate = DateTime.fromFormat(myDate, 'dd/MM/yy HH:mm', {
      zone: 'Europe/Paris',
      locale: 'fr',
    })
    const leanPlace = { inspecteur, date: formatedDate, centre: centre._id }
    await createPlace(leanPlace)
    appLogger.info({
      section: 'Admim-BuisnessPlaces',
      action: 'createPlaceForInspector',
      message: `Place {${centre.departement}, ${
        centre.nom
      }, ${inspecteur}, ${myDate}} enregistrée en base`,
    })
    return getPlaceStatus(
      centre.departement,
      centre.nom,
      inspecteur,
      myDate,
      'success',
      `Place enregistrée en base`
    )
  } catch (error) {
    appLogger.error(JSON.stringify(error))
    if (error.message === PLACE_ALREADY_IN_DB_ERROR) {
      appLogger.warn({
        section: 'Admim-BuisnessPlaces',
        action: 'createPlaceForInspector',
        message: 'Place déjà enregistrée en base',
      })
      return getPlaceStatus(
        centre.departement,
        centre.nom,
        inspecteur,
        myDate,
        'error',
        'Place déjà enregistrée en base'
      )
    }
    return getPlaceStatus(
      centre.departement,
      centre.nom,
      inspecteur,
      date,
      'error',
      error.message
    )
  }
}

export const moveCandidatInPlaces = async (resaId, placeId) => {
  const loggerContent = {
    section: 'admin-move-candidat-in-places',
    resaId,
    placeId,
  }

  const resa = await findPlaceById(resaId)
  if (!resa) {
    throw new ErrorWithStatus(404, 'Réservation non trouvée')
  }
  const place = await findPlaceById(placeId)
  if (!place) {
    throw new ErrorWithStatus(404, 'Réservation non trouvée')
  }
  const { candidat } = resa

  if (!candidat) {
    throw new ErrorWithStatus(400, "Cette réservation n'a pas de candidat")
  }
  if (place.candidat) {
    throw new ErrorWithStatus(400, RESA_PLACE_HAS_BOOKED)
  }

  if (resa.centre.toString() !== place.centre.toString()) {
    throw new ErrorWithStatus(
      400,
      'le nouveau centre est différent à celle de la réservation'
    )
  }
  if (
    DateTime.fromJSDate(resa.date).diff(DateTime.fromJSDate(place.date)) > 0
  ) {
    throw new ErrorWithStatus(
      400,
      'La nouvelle date et heure sont différents à celle de la réservation'
    )
  }

  appLogger.info({
    ...loggerContent,
    action: 'BOOK_RESA',
    placeId,
    candidat,
  })

  const newResa = await bookPlaceById(placeId, candidat)
  if (!newResa) {
    throw new ErrorWithStatus(400, 'Cette place posséde une réservation')
  }

  appLogger.info({
    ...loggerContent,
    action: 'DELETE_RESA',
    resaId,
  })
  await deletePlace(resa)

  return newResa
}
