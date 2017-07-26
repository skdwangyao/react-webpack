import React from 'react';
import ReactDOM from 'react-dom';


// require('../sass/index.scss')
import '../sass/index.scss';

class App extends React.Component{
	constructor(props) {
        super(props);
    }
    
  	render() {
  		return <div className='demo'>
  			<h1 className='red'>Hello, World</h1>
  		</div>
 	}
}

ReactDOM.render(<App/>, document.getElementById('content'));