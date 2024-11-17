// models/User.js

const db = require('../config/database');
const bcrypt = require('bcrypt');

class User {
  // Localizar usuário por identificador (email, CPF, telefone, etc.)
  static async findByIdentifier(identifier) {
    const query = `
      SELECT ua.*
      FROM user_accounts ua
      JOIN persons p ON ua.person_id = p.person_id
      LEFT JOIN person_contacts pc ON p.person_id = pc.person_id
      LEFT JOIN contacts c ON pc.contact_id = c.contact_id
      LEFT JOIN person_documents pd ON p.person_id = pd.person_id
      WHERE UPPER(c.contact_value) = UPPER($1)
         OR UPPER(pd.document_value) = UPPER($1)
      LIMIT 1
    `;

    try {
      const result = await db.query(query, [identifier]);
      return result.rows[0];
    } catch (err) {
      console.error('Erro ao buscar por identificador:', err);
      throw err;
    }
  }

  // Criar novo usuário
  static async create({ username, password, personData, contacts, licenseId, profileId }) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      // Etapa 1: Inserir ou verificar a pessoa
      const personQuery = `
        INSERT INTO persons (full_name, birth_date)
        VALUES ($1, $2)
        ON CONFLICT (full_name) DO NOTHING
        RETURNING person_id
      `;
      const personResult = await client.query(personQuery, [personData.fullName, personData.birthDate]);
      let personId = personResult.rows[0]?.person_id;

      if (!personId) {
        const existingPersonQuery = `
          SELECT person_id FROM person_documents
          WHERE UPPER(document_value) = UPPER($1) AND document_type = 'cpf'
        `;
        const existingPersonResult = await client.query(existingPersonQuery, [personData.cpf]);
        personId = existingPersonResult.rows[0]?.person_id;
      }

      if (!personId) {
        throw new Error('Não foi possível criar ou localizar a pessoa.');
      }

      // Etapa 2: Inserir o usuário
      const userQuery = `
        INSERT INTO user_accounts (username, password, person_id, profile_id)
        VALUES ($1, $2, $3, $4)
        RETURNING user_id
      `;
      const userResult = await client.query(userQuery, [username, hashedPassword, personId, profileId]);
      const userId = userResult.rows[0].user_id;

      // Etapa 3: Relacionar contatos
      for (const contact of contacts) {
        const contactQuery = `
          INSERT INTO contacts (contact_type, contact_value, is_active)
          VALUES ($1, $2, TRUE)
          ON CONFLICT (contact_value, contact_type) DO NOTHING
          RETURNING contact_id
        `;
        const contactResult = await client.query(contactQuery, [contact.type, contact.value]);
        const contactId = contactResult.rows[0]?.contact_id;

        if (contactId) {
          const personContactQuery = `
            INSERT INTO person_contacts (person_id, contact_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `;
          await client.query(personContactQuery, [personId, contactId]);
        }
      }

      // Etapa 4: Relacionar a licença ao usuário
      if (licenseId) {
        const licenseQuery = `
          INSERT INTO user_license (user_id, license_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `;
        await client.query(licenseQuery, [userId, licenseId]);
      }

      await client.query('COMMIT');
      return userId;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Erro ao criar usuário:', err);
      throw err;
    } finally {
      client.release();
    }
  }

  // Validar senha
  static async validatePassword(user, password) {
    try {
      return await bcrypt.compare(password, user.password);
    } catch (err) {
      console.error('Erro ao validar senha:', err);
      throw err;
    }
  }

  // Atualizar a senha do usuário
  static async updatePassword(identifier, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const query = `
      UPDATE user_accounts
      SET password = $1
      WHERE user_id = (
        SELECT ua.user_id
        FROM user_accounts ua
        JOIN persons p ON ua.person_id = p.person_id
        LEFT JOIN person_contacts pc ON p.person_id = pc.person_id
        LEFT JOIN contacts c ON pc.contact_id = c.contact_id
        LEFT JOIN person_documents pd ON p.person_id = pd.person_id
        WHERE UPPER(c.contact_value) = UPPER($2)
           OR UPPER(pd.document_value) = UPPER($2)
        LIMIT 1
      )
    `;

    try {
      await db.query(query, [hashedPassword, identifier]);
      return true;
    } catch (err) {
      console.error('Erro ao atualizar senha:', err);
      throw err;
    }
  }
}

module.exports = User;