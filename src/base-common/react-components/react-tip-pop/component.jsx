import React from 'react'

require('./component.scss')


class reactTipPop extends React.Component {
    constructor(props) {
        super(props);
        this.displayName = 'reactTipPop';
        this.show = this.show.bind(this);
        this.hide = this.hide.bind(this);
        this.common = {
        	timer : null,
            //延时隐藏时间
        	delayedSecond : this.props.delayedSecond?this.props.delayedSecond*1000:2500
        };
        this.state = {
            value : ''
        }
    }
    show(value){//显示提示框
        if(value){
            this.delayedHide();
            this.setState({value});
        }
    }
    hide(){//隐藏提示框
        clearTimeout(this.common.timer);
        this.state.value && this.setState({
            value:''
        });
    }
    delayedHide(){//延时隐藏
    	clearTimeout(this.common.timer);
    	this.common.timer = setTimeout(()=>{
    		this.hide();
    	},this.common.delayedSecond)
    }
    //通过addEventListener绑定在body上的click由于冒泡机制会先于react onClick执行
    componentDidMount(){
        document.body.addEventListener("click",this.hide,false);
    }
    componentWillUnmount(){
        clearTimeout(this.common.timer);
        document.body.removeEventListener("click",this.hide,false);
    }
    render() {
        return  <div className={ this.state.value ? 'react-tip-pop show' : 'react-tip-pop'}>
        			<div className="react-tip-pop-cont" dangerouslySetInnerHTML = {{__html:this.state.value}}></div>
        		</div>;
    }
}

export default reactTipPop;
