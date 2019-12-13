import request from 'supertest'
import express from 'express'
import bodyParser from 'body-parser'

import { connect, disconnect } from '../../mongo-connection'

import { createUser } from '../../models/user'

import {
  setInitCreatedCentre,
  createCentres,
  removeCentres,
  createPlaces,
  removePlaces,
  centres,
  createCandidats,
  deleteCandidats,
  makeResas,
  commonBasePlaceDateTime,
} from '../../models/__tests__/'

import {
  NOT_CODE_DEP_MSG,
  getAdminCentres,
  enableOrDisableCentre,
  createCentre,
} from './centre-controllers'
import { getFrenchLuxon } from '../../util'

const { default: app, apiPrefix } = require('../../app')

jest.mock('../middlewares/verify-token')

const bookedAt = getFrenchLuxon().toJSDate()

xdescribe('Test centre candidat controllers', () => {
  beforeAll(async () => {
    await connect()
  })

  afterAll(async () => {
    await disconnect()
    await app.close()
  })

  describe('Find centres', () => {
    let createdCandiats
    beforeAll(async () => {
      createdCandiats = await createCandidats()
      await createCentres()
      await createPlaces()
      await makeResas(bookedAt)
    })
    afterAll(async () => {
      await removePlaces()
      await removeCentres()
      await deleteCandidats()
    })

    it('Should response 400 to find centres without departement', async () => {
      const { body } = await request(app)
        .get(`${apiPrefix}/candidat/centres`)
        .set('Accept', 'application/json')
        .expect(400)

      expect(body).toBeDefined()
      expect(body).toHaveProperty('success', false)
      expect(body).toHaveProperty('message', NOT_CODE_DEP_MSG)
    })

    it('Should response 200 to find 2 centres from departement 93 to date 19', async () => {
      require('../middlewares/verify-token').__setIdAdmin(undefined)

      const departement = '93'
      let dateTime = commonBasePlaceDateTime.set({ day: 18 })
      if (dateTime < getFrenchLuxon()) {
        dateTime = dateTime.plus({ month: 1 })
      }
      const date = encodeURIComponent(dateTime.toISO())
      const { body } = await request(app)
        .get(
          `${apiPrefix}/candidat/centres?departement=${departement}&begin=${date}`
        )
        .set('Accept', 'application/json')
        .expect(200)

      expect(body).toBeDefined()
      expect(body).toHaveLength(2)
      body.forEach(element => {
        if (element.centre.nom === centres[0].nom) {
          expect(element.count).toBe(0)
        }
        if (element.centre.nom === centres[1].nom) {
          expect(element.count).toBe(1)
        }
        if (element.centre.nom === centres[2].nom) {
          expect(element.count).toBe(4)
        }
      })
    })

    it('Should response 200 to find 2 centres from departement 93 to date 20', async () => {
      require('../middlewares/verify-token').__setIdAdmin(undefined)
      const departement = '93'
      let dateTime = commonBasePlaceDateTime.set({ day: 20 })
      if (dateTime < getFrenchLuxon()) {
        dateTime = dateTime.plus({ month: 1 })
      }
      const date = encodeURIComponent(dateTime.toISO())
      const { body } = await request(app)
        .get(
          `${apiPrefix}/candidat/centres?departement=${departement}&begin=${date}`
        )
        .set('Accept', 'application/json')
        .expect(200)

      expect(body).toBeDefined()
      expect(body).toHaveLength(2)
      body.forEach(element => {
        if (element.centre.nom === centres[0].nom) {
          expect(element.count).toBe(0)
        }
        if (element.centre.nom === centres[1].nom) {
          expect(element.count).toBe(0)
        }
        if (element.centre.nom === centres[2].nom) {
          expect(element.count).toBe(3)
        }
      })
    })

    it('Should response 200 to find 2 centres from departement 93', async () => {
      const selectedCandidat = createdCandiats[0]
      require('../middlewares/verify-token').__setIdCandidat(
        selectedCandidat._id
      )
      const departement = '93'
      const { body } = await request(app)
        .get(`${apiPrefix}/candidat/centres?departement=${departement}`)
        .set('Accept', 'application/json')
        .expect(200)

      expect(body).toBeDefined()
      expect(body).toHaveLength(2)
      body.forEach(element => {
        if (element.centre.nom === centres[0].nom) {
          expect(element.count).toBe(0)
        }
        if (element.centre.nom === centres[1].nom) {
          expect(element.count).toBe(1)
        }
        if (element.centre.nom === centres[2].nom) {
          expect(element.count).toBe(4)
        }
      })
    })

    it('Should response 200 and a center', async () => {
      const nom = 'Centre 1'
      const departement = '92'
      const { body: centre } = await request(app)
        .get(
          `${apiPrefix}/candidat/centres?nom=${nom}&departement=${departement}`
        )
        .set('Accept', 'application/json')
        .expect(200)

      expect(centre).toBeDefined()
      expect(centre).not.toBeNull()
      expect(centre).toHaveProperty('nom', nom)
      expect(centre).toHaveProperty('departement', departement)
      expect(centre.adresse).toContain(departement)
    })
  })
})

describe('Centre controllers admin', () => {
  let mockApp
  let admin

  beforeAll(async () => {
    await connect()
    const departements = ['92', '93']
    const email = 'admin@example.com'
    const password = 'S3cr3757uff!'
    admin = await createUser(email, password, departements)
    setInitCreatedCentre()
    await createCentres()
  })

  afterAll(async () => {
    await removeCentres()
    await disconnect()
    await mockApp.close()
  })

  it('Get all centers from the 93 for admin', async () => {
    mockApp = express()
    mockApp.use((req, res, next) => {
      req.userId = admin._id
      req.departements = ['93']
      next()
    })
    mockApp.use(getAdminCentres)

    const { body } = await request(mockApp)
      .get(`${apiPrefix}/admin/centres`)
      .set('Accept', 'application/json')
      .expect(200)

    expect(body).toBeDefined()
    expect(body).toHaveProperty('success', true)
    expect(body).toHaveProperty('centres')
    expect(body.centres).toHaveLength(2)
  })

  it('Disable a center', async () => {
    mockApp = express()
    mockApp.use((req, res, next) => {
      req.userId = admin._id
      req.departements = admin.departements
      next()
    })
    mockApp.use(bodyParser.json({ limit: '20mb' }))
    mockApp.use(bodyParser.urlencoded({ limit: '20mb', extended: false }))

    mockApp.get(`${apiPrefix}/admin/centres`, getAdminCentres)
    mockApp.patch(`${apiPrefix}/admin/centres`, enableOrDisableCentre)

    const getRequest = await request(mockApp)
      .get(`${apiPrefix}/admin/centres`)
      .set('Accept', 'application/json')
      .expect(200)

    const centreId = getRequest.body.centres[0]._id
    const { body } = await request(mockApp)
      .patch(`${apiPrefix}/admin/centres`)
      .send({ centreId, active: false })
      .set('Accept', 'application/json')
      .expect(200)

    expect(body).toBeDefined()
    expect(body).toHaveProperty('success', true)
    expect(body).toHaveProperty('centre')
    expect(body.centre).toHaveProperty('active', false)
  })

  it('Add a center', async () => {
    mockApp = express()
    mockApp.use((req, res, next) => {
      req.userId = admin._id
      req.departements = admin.departements
      next()
    })
    mockApp.use(bodyParser.json({ limit: '20mb' }))
    mockApp.use(bodyParser.urlencoded({ limit: '20mb', extended: false }))

    mockApp.post(`${apiPrefix}/admin/centres`, createCentre)

    const { body } = await request(mockApp)
      .post(`${apiPrefix}/admin/centres`)
      .send({
        nom: 'Noisy le Grand',
        label: "Centre d'examen du permis de conduire de Noisy le Grand",
        adresse: '5 boulevard de Champs Richardets 93160 Noisy le Grand',
        lon: 2.473647,
        lat: 48.883956,
        departement: '93',
      })
      .set('Accept', 'application/json')
      .expect(200)

    expect(body).toBeDefined()
    expect(body).toHaveProperty('success', true)
    expect(body).toHaveProperty('centre')
    expect(body.centre).toHaveProperty('nom', 'Noisy le Grand')
    expect(body.centre).toHaveProperty('departement', '93')
  })
})
