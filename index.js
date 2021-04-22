// Global config injection
typeof window !== 'undefined' ?
  window.config = require('./.config') :
  global.config = require(__dirname + '/.config')

const bcrypt = require('bcrypt')
const fastify = require('fastify')({logger: true})
const cors = require('fastify-cors')
const jwt = require('jsonwebtoken')
const {ServerClient} = require('postmark')
const {Pool} = require('pg')

const {
  DB_HOST,
  DB_PORT,
  DB_NAME,
  DB_USER,
  DB_PASS,
  DB_CERT,
  DB_KEY,
  POSTMARK_API_TOKEN,
  JWT_SECRET
} = process.env

const BCRYPT_SALT_ROUNDS = 10

/**
 * Database
 */
const pool = new Pool({
  host: DB_HOST || 'localhost',
  port: DB_PORT || 26257,
  database: DB_NAME,
  user: DB_USER,
  pass: DB_PASS,
  ssl: {
    cert: DB_CERT ? Buffer.from(DB_CERT, 'base64') : null,
    key: DB_KEY ? Buffer.from(DB_KEY, 'base64') : null
  }
})

// Models
const Members = require('./models/members')

const models = {
  members: new Members(pool)
}

/**
 * Postmark client
 */
const postmarkClient = new ServerClient(POSTMARK_API_TOKEN)

/**
 * Server
 */
// Middleware
fastify.register(cors, {origin: config.WEBSITE_HOST})

// Routes
fastify.get('/', async (request, response) => {
  response.send('OK')
})

fastify.get('/member/:id', async (request, response) => {
  const token = getJWTToken(request)

  if (token) {
    const id = request.params.id
    const payload = await jwt.verify(token, JWT_SECRET)

    if (id === payload.id) {
      const {
        name
      } = await models.members.findMemberWithId(id)

      request.send({
        name, email
      })
    }
  }
})

fastify.post('/member/login', async (request, response) => {
  const {email, password} = request.body

  if (email && password) {
    try {
      let member = await models.members.findMember('email', email)
      member = member[0]

      if (member) {
        const isPasswordValid = await brcypt.compare(password, member.password)

        if (isPasswordValid) {
          const body = jwt.sign({
            id,
            name,
            email
          } = member, JWT_SECRET)

          response.send({body})
        } else {
          response.code(403)
          response.send()
        }
      } else {
        response.code(403)
        response.send()
      }
    } catch(err) {
      response.code(500)
      response.send(err)
    }
  } else {
    response.code(403)
    response.send()
  }
})

fastify.post('/member/signup', async (request, response) => {
  const {name, email, password} = request.body

  if (name && email && password) {
    try {
      let memberWithEmail = await models.members.findMemberWithEmail(email)
      memberWithEmail = memberWithEmail[0]

      if (!memberWithEmail) {
        let member = await models.members.createMember({
          name,
          email,
          password: await bcrypt.hash(password, BCRYPT_SALT_ROUNDS)
        })
        member = member[0]

        await postmarkClient.sendEmail({
          'From': 'system@clubnorse.com',
          'To': member.email,
          'Subject': 'Welcome — Club Norse',
          'HtmlBody': `Hi ${member.name.split(' ')[0]},<br /><br />Welcome to Club Norse!<br /><br />Please verify your email address by following the link below<br />${config.WEBSITE_HOST}/member/verify?email=${member.email}&token=${member.verification_token}.<br /><br />Once your email is verified you can start using your new account.<br /><br />In case you have any questions, please don't hesitate to contact our support on support@clubnorse.com<br /><br />&mdash; The Club Norse team`
        })

        response.send('OK')
      }
    } catch(err) {
      response.code(500)
      response.send(err)
    }
  } else {
    response.code(422)
    response.send()
  }
})

fastify.post('/member/verify', async (request, response) => {
  const {email, token} = request.body

  if (email || token) {
    try {
      let memberWithEmail = await models.members.findMemberWithEmail(email)
      let member = memberWithEmail[0]

      if (member && member.verification_pending && member.verification_token === token) {
        await models.members.verifyMember(email, token)

        await postmarkClient.sendEmail({
          'From': 'system@clubnorse.com',
          'To': email,
          'Subject': 'Verification successful — Club Norse',
          'HtmlBody': `Thank you for verifying your email.<br />Proceed to our member's area to access the latest discounts and exclusive offers<br />${config.WEBSITE_HOST}/member/login<br /><br />&mdash; The Club Norse team`
        })

        response.send('OK')
      } else {
        response.code(422)
        response.send()
      }
    } catch(err) {
      response.code(500)
      response.send(err)
    }
  } else {
    response.code(422)
    response.send()
  }
})

// Handler
fastify.listen(3001, '0.0.0.0', error => {
  if (error) {
    throw error
  }
})

/**
 * Helpers
 */
function getJWTToken(request) {
  if (request.headers) {
    const header = request.headers.authorization

    if (typeof header !== 'undefined') {
      const headerValues = header.split(' ')

      if (headerValues.length === 2) {
        const scheme = headerValues[0]
        const token = headerValues[1]

        if (/^Bearer$/i.test(scheme)) {
          return token
        }
      }
    }
  }
}
