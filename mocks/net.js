// Mock implementation of the net module
module.exports = {
  createConnection: () => ({
    on: () => {},
    write: () => {},
    end: () => {},
    connect: () => {},
    destroy: () => {}
  }),
  Socket: class Socket {
    constructor() {
      this.on = () => this;
      this.write = () => true;
      this.end = () => this;
      this.connect = () => this;
      this.destroy = () => this;
    }
  }
};
