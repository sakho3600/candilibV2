/**
 * Schema et model des IPCSR
 *
 * @module
 */

import mongoose from 'mongoose'
import sanitizeHtml from 'sanitize-html'

import { email as emailRegex, matricule as matriculeRegex } from '../../util'

const { Schema } = mongoose

export const inspecteurFields = {
  active: {
    type: Boolean,
    required: false,
  },

  nom: {
    type: String,
    required: true,
    uppercase: true,
  },

  prenom: {
    type: String,
    required: false,
  },

  email: {
    type: String,
    required: true,
    unique: true,
    match: emailRegex,
  },

  matricule: {
    type: String,
    required: true,
    match: matriculeRegex,
    unique: true,
  },

  departement: {
    type: String,
    required: false,
  },
}

const inspecteurSchema = new Schema(inspecteurFields, { timestamps: true })

inspecteurSchema.pre('save', async function preSave () {
  const inspecteur = this

  Object.keys(inspecteurFields).map(key => {
    const value = inspecteur[key]
    if (value && typeof value === 'string') {
      inspecteur[key] = sanitizeHtml(value)
    }
  })

  inspecteur.prenom =
    inspecteur.prenom &&
    inspecteur.prenom.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  inspecteur.nom =
    inspecteur.nom &&
    inspecteur.nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  inspecteur.email = inspecteur.email.toLowerCase()
})

inspecteurSchema.index({
  nom: 'text',
  prenom: 'text',
  mail: 'text',
  matricule: 'text',
})

export default mongoose.model('Inspecteur', inspecteurSchema)

/**
 * @typedef {Object} InspecteurMongooseDocument
 * @mixes import('mongoose').Document
 *
 * @property {string} email - Adresse courriel de l'IPCSR
 * @property {string} matricule - Matricule de l'IPCSR
 * @property {string} departement - Département d'intervention de l'IPCSR
 * @property {string} nom - Nom de l'IPCSR
 * @property {string} prenom - Prénom de l'IPCSR
 */
