const { SeoOverride } = require('../index');
const AppError = require('../../utils/AppError');

class SeoOverrideService {
  async getAll() {
    return await SeoOverride.findAll({
      order: [['path', 'ASC']]
    });
  }

  async getById(id) {
    const override = await SeoOverride.findByPk(id);
    if (!override) throw new AppError('NOT_FOUND', 404, 'SEO Override not found');
    return override;
  }

  async getByPath(path) {
    return await SeoOverride.findOne({ where: { path } });
  }

  async create(data) {
    try {
      return await SeoOverride.create(data);
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        throw new AppError('DUPLICATE_PATH', 400, 'SEO Override for this path already exists');
      }
      throw err;
    }
  }

  async update(id, data) {
    const override = await this.getById(id);
    
    try {
      await override.update(data);
      return override;
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        throw new AppError('DUPLICATE_PATH', 400, 'SEO Override for this path already exists');
      }
      throw err;
    }
  }

  async delete(id) {
    const override = await this.getById(id);
    await override.destroy();
    return true;
  }
}

module.exports = new SeoOverrideService();
