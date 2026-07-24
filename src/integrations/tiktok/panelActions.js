const createActions = require("./panelActionsCreate");
const manageActions = require("./panelActionsManage");

module.exports = {
  ...createActions,
  ...manageActions,
};
