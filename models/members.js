module.exports = class Members {
  constructor(pool = null, table = 'members') {
    this.pool = pool
    this.table = table
  }

  findAllMembers() {
    return query(this.pool,
      `SELECT *
      FROM ${this.table}`
    )
  }

  findMember(column, value) {
    return query(this.pool,
      `SELECT *
      FROM ${this.table}
      WHERE ${column} = '${value}'`
    )
  }

  findMemberWithId(id) {
    return this.findMember('id', id)
  }

  findMemberWithEmail(email) {
    return this.findMember('email', email)
  }

  verifyMember(email, token) {
    return query(this.pool,
      `UPDATE ${this.table}
      SET (verified_at, verification_pending, verification_token) = (CURRENT_TIMESTAMP, false, NULL)
      WHERE (email = '${email}' AND verification_pending = true AND verification_token = '${token}')
      RETURNING name, email`
    )
  }

  unverifyMember() {}

  createMember(details) {
    const {name, email, password} = details
    return query(this.pool,
      `INSERT INTO ${this.table} (name, email, password)
      VALUES ('${name}', '${email}', '${password}')
      RETURNING name, email, verification_token`
    )
  }

  updateMember(column, value) {

  }

  deleteMember(column, value) {
    return query(this.pool, ``)
  }
}

function query(pool, query) {
  return new Promise((resolve, reject) => {
    pool.connect().then(async client => {
      try {
        const {rows} = await client.query(query)
        resolve(rows)
      } catch(error) {
        reject(error)
      }
      client.release()
    }).catch(error => {
      reject(error)
    })
  })
}
