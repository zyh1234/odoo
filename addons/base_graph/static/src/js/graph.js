/*---------------------------------------------------------
 * OpenERP base_graph
 *---------------------------------------------------------*/

openerp.base_graph = function (openerp) {
QWeb.add_template('/base_graph/static/src/xml/base_graph.xml');
openerp.base.views.add('graph', 'openerp.base_graph.GraphView');
openerp.base_graph.GraphView = openerp.base.Controller.extend({

    init: function(view_manager, session, element_id, dataset, view_id) {
        this._super(session, element_id);
        this.view_manager = view_manager;
        this.dataset = dataset;
        this.model = this.dataset.model;
        this.view_id = view_id;
    },
    do_show: function () {
        // TODO: re-trigger search
        this.$element.show();
    },
    do_hide: function () {
        this.$element.hide();
    },
    start: function() {
        this.rpc("/base_graph/graphview/load", {"model": this.model, "view_id": this.view_id}, this.on_loaded);
    },
    on_loaded: function(data) {
        var self = this;
        this.all_fields = data.all_fields;
        this.fields_view = data.fields_view;
        this.name = this.fields_view.name || this.fields_view.arch.attrs.string;
        this.view_id = this.fields_view.view_id;
        this.chart = this.fields_view.arch.attrs.type || 'pie';
        this.fields = this.fields_view.fields;
        this.chart_info_fields = [];
        this.operator_field = '';
        this.operator_field_one = '';
        this.operator = [];
        this.group_field = '';
        this.orientation = this.fields_view.arch.attrs.orientation || '';

        for(fld in this.fields_view.arch.children) {
            if (this.fields_view.arch.children[fld].attrs.operator) {
                this.operator.push(this.fields_view.arch.children[fld].attrs.name);
            }
            else if (this.fields_view.arch.children[fld].attrs.group) {
                this.group_field = this.fields_view.arch.children[fld].attrs.name;
            }
            else {
                this.chart_info_fields.push(this.fields_view.arch.children[fld].attrs.name);
            }
        }
        this.operator_field = this.operator[0];
        if(this.operator.length > 1){
            this.operator_field_one = this.operator[1];
        }
        if(this.operator == ''){
            this.operator_field = this.chart_info_fields[1];
        }
        this.chart_info = this.chart_info_fields[0];
        this.x_title = this.fields[this.chart_info_fields[0]]['string'];
        this.y_title = this.fields[this.operator_field]['string'];
        self.load_chart();
    },

    load_chart: function(data) {
        var self = this;
        if(data){
            this.x_title = this.all_fields[this.chart_info_fields]['string'];
            this.y_title = this.all_fields[this.operator_field]['string'];
            self.schedule_chart(data);
        }else{
            this.dataset.read_ids(
                this.dataset.ids,
                {},
                function(res) {
                    self.schedule_chart(res);
                }
            );
        }
    },

    schedule_chart: function(result) {
        this.$element.html(QWeb.render("GraphView", {"fields_view": this.fields_view, "chart": this.chart,'view_id': this.view_id}));
        this.opration_fld = {};
        if (result.length){
            for(var res in result) {
                for(var fld in result[res]) {
                    if (typeof result[res][fld] == 'object') {
                        result[res][fld] = result[res][fld][result[res][fld].length - 1];
                    }
                    if (typeof result[res][fld] == 'string'){
                        if (this.all_fields[fld]['selection']){
                            for (i in this.all_fields[fld]['selection']){
                                if(result[res][fld] == this.all_fields[fld]['selection'][i][0]){
                                   result[res][fld] = this.all_fields[fld]['selection'][i];
                                }
                            }
                        }
                    }
                }
            }

            for (var i in result){
                var gen_key = result[i][this.chart_info_fields]+"_"+result[i][this.group_field];
                if (this.opration_fld[gen_key] == undefined){
                    var map_val = {};
                    map_val[this.operator_field] = result[i][this.operator_field];
                    if (this.operator.length > 1){
                        map_val[this.operator_field_one] = result[i][this.operator_field_one];
                    }
                    map_val[this.chart_info_fields] = result[i][this.chart_info_fields];
                    if (this.group_field){
                        map_val[this.group_field] = (typeof result[i][this.group_field] == 'object')?result[i][this.group_field][1]:result[i][this.group_field];
                    }
                    this.opration_fld[gen_key] = map_val;
                }else{
                    map_val = this.opration_fld[gen_key];
                    map_val[this.operator_field] += result[i][this.operator_field];
                    if (this.operator.length > 1){
                        map_val[this.operator_field_one] += result[i][this.operator_field_one];
                    }
                    this.opration_fld[gen_key] = map_val;
                }
            }
            result = [];
            for (i in this.opration_fld){
                result.push(this.opration_fld[i]);
            }

            if(this.chart == 'bar') {
                return this.schedule_bar(result);
            } else if(this.chart == "pie") {
                return this.schedule_pie(result);
            }
        }
    },

    schedule_bar: function(result) {
        var self = this;
        var view_chart = '';
        var xystr = {};
        var xyname = {};
        var res = [];
        this.group_list = [];
        var newkey = '';

        var COLOR_PALETTE = ['#cc99ff', '#ccccff', '#48D1CC', '#CFD784', '#8B7B8B', '#75507b', '#b0008c', '#ff0000', '#ff8e00', '#9000ff', '#0078ff', '#00ff00', '#e6ff00', '#ffff00',
                     '#905000', '#9b0000', '#840067', '#9abe00', '#ffc900', '#510090', '#0000c9', '#009b00',
                     '#75507b', '#3465a4', '#73d216', '#c17d11', '#edd400', '#fcaf3e', '#ef2929', '#ff00c9',
                     '#ad7fa8', '#729fcf', '#8ae234', '#e9b96e', '#fce94f', '#f57900', '#cc0000', '#d400a8'];

        if(self.group_field && (this.operator.length <= 1)){
            view_chart = self.orientation == 'horizontal'? 'stackedBarH' : 'stackedBar';
        }else{
            view_chart = self.orientation == 'horizontal'? 'barH' : 'bar';
        }

        for (i in result){
            if (self.group_field && (this.operator.length <= 1)){
                newkey =result[i][self.group_field].split(' ').join('_');
            }else{
                newkey = "val";
            }

            if (jQuery.inArray(newkey, self.group_list) == -1){
                self.group_list.push(newkey);
                if(this.operator.length > 1){
                    var newkey_one = "val1";
                    self.group_list.push(newkey_one);
                }
            }
        }

        for (i in result){
            var xystring = result[i][self.chart_info_fields];
            if (self.group_field && (self.operator.length <= 1)){
                newkey =result[i][self.group_field].split(' ').join('_');
            }else{
                newkey = "val";
            }
            if (xystr[xystring] == undefined){
                xyname = {};
                xyname[self.chart_info_fields] = xystring;
                for (var j in self.group_list){
                    xyname[self.group_list[j]] = 0.0001;
                }
                xyname[newkey] = result[i][self.operator_field];
                if (self.operator.length > 1){
                    xyname[newkey_one] = result[i][self.operator_field_one];
                }
                xystr[xystring] = xyname;
            }
            else{
                xyname = {};
                xyname = xystr[xystring];
                xyname[newkey] = result[i][self.operator_field];
                if (self.operator.length > 1){
                    xyname[newkey_one] = result[i][self.operator_field_one];
                }
                xystr[xystring] = xyname;
            }
        }
        for (i in xystr){
            res.push(xystr[i]);
        }

        //for legend color
        var grp_color = [];
        for (var i in self.group_list){
            var legend = {};
            if (self.group_list[i] == "val"){
                legend['text'] = self.fields[self.operator_field]['string']
            }else if(self.group_list[i] == "val1"){
                legend['text'] = self.fields[self.operator_field_one]['string']
            }else{
                legend['text'] = self.group_list[i];
            }
            legend['color'] = COLOR_PALETTE[i];
            grp_color.push(legend);
        }

        //for axis's value and title
        var temp_ax = {};
        var oth_ax = {};
        temp_ax['template'] = self.chart_info_fields;
        temp_ax['title'] = "<b>"+self.x_title+"</b>" ;
        oth_ax['lines'] = true;
        oth_ax['title'] = "<b>"+self.y_title+"</b>";

        if (self.orientation == 'horizontal'){
             var x_ax = oth_ax;
             var y_ax = temp_ax;
        }else{
             var x_ax = temp_ax;
             var y_ax = oth_ax;
        }

        var bar_chart = new dhtmlxchartChart({
            view: view_chart,
            container: self.view_id+"-barchart",
            value:"#"+self.group_list[0]+"#",
            gradient: "3d",
            border: false,
            width: 1024,
            radius: 0,
            color:grp_color[0]['color'],
            origin:0,
            xAxis:{
                template:function(obj){
                    if(x_ax['template']){
                        var val = obj[x_ax['template']];
                        val = (typeof val == 'object')?val[1]:(!val?'Undefined':val);
                        return val;
                    }else{
                        return obj;
                    }
                },
                title:x_ax['title'],
                lines:x_ax['lines']
            },
            yAxis:{
                template:function(obj){
                    if(y_ax['template']){
                        var vals = obj[y_ax['template']];
                        vals = (typeof vals == 'object')?vals[1]:(!vals?'Undefined':vals);
                        return vals;
                    }else{
                        return obj;
                    }
                },
                title:y_ax['title'],
                lines: y_ax['lines']
            },
            padding: {
                left: 75
            },
            legend: {
                values: grp_color,
                align:"left",
                valign:"top",
                layout: "x",
                marker:{
                    type:"round",
                    width:12
                }
            }
        });
        for (var i = 1; i<self.group_list.length;i++){
            bar_chart.addSeries({
                value: "#"+self.group_list[i]+"#",
                color: grp_color[i]['color']
            });
        }
        bar_chart.parse(res,"json");
        bar_chart.attachEvent("onItemClick", function(id) {
            var id = bar_chart.get(id);
            self.open_list_view(id);
        });
    },
    schedule_pie: function(result) {
        var self = this;
        var chart =  new dhtmlxchartChart({
            view:"pie3D",
            container:self.view_id+"-piechart",
            value:"#"+self.operator_field+"#",
            pieInnerText:function(obj) {
                var sum = chart.sum("#"+self.operator_field+"#");
                var val = obj[self.operator_field] / sum * 100 ;
                return Math.round(val * 10)/10 + "%";
            },
            gradient:"3d",
            height: 20,
            radius: 200,
            legend: {
                width: 300,
                align:"left",
                valign:"top",
                layout: "x",
                marker:{
                    type:"round",
                    width:12
                },
                template:function(obj){
                    var val = obj[self.chart_info_fields];
                    val = (typeof val == 'object')?val[1]:val;
                    return val;
                }
            }
        });
        chart.parse(result,"json");
        chart.attachEvent("onItemClick", function(id) {
            var id = chart.get(id);
            self.open_list_view(id);
        });
    },
    open_list_view : function (id){
        var self = this;
        var id = id[self.chart_info_fields];
        if (typeof id == 'object'){
            id = id[0];
        }else{
            id = id;
        }
        if(this.view_manager.action.context){
           this.view_manager.action.context = {};
        }
        if(!this.view_manager.action.domain) {
            this.view_manager.action.domain = [[self.chart_info_fields, '=', id],['id','in',self.dataset.ids]];
        } else {
            this.view_manager.action.domain.push([self.chart_info_fields, '=', id],['id','in',self.dataset.ids]);
        }
        var action_manager = new openerp.base.ActionManager(this.view_manager.session, this.view_manager.element_id);
        action_manager.start();
        action_manager.do_action(this.view_manager.action);
    },
    do_search: function(domains, contexts, groupbys) {
        var self = this;
        this.rpc('/base/session/eval_domain_and_context', {
            domains: domains,
            contexts: contexts,
            group_by_seq: groupbys
        }, function (results) {
            // TODO: handle non-empty results.group_by with read_group
            if(results.group_by  && results.group_by != ''){
                self.chart_info_fields = results.group_by[0];
            }else{
                self.chart_info_fields = self.chart_info;
            }
            self.dataset.context = self.context = results.context;
            self.dataset.domain = self.domain = results.domain;
            self.dataset.read_slice({}, 0, self.limit,function(response){
                self.load_chart(response);
            });
        });
    }

});

// here you may tweak globals object, if any, and play with on_* or do_* callbacks on them

};

// vim:et fdc=0 fdl=0:
